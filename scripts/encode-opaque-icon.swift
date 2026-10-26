// PNG encoding normalization only: retain every RGB sample and color-profile chunk.
// Refuse unsupported formats and any nonopaque alpha sample before writing.
import Foundation
import zlib

func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw NSError(domain: message, code: 1) }
}
func u32(_ bytes: [UInt8], _ offset: Int) -> Int {
    bytes[offset..<offset+4].reduce(0) { ($0 << 8) | Int($1) }
}
func bigEndian(_ value: Int) -> [UInt8] {
    [24,16,8,0].map { UInt8((value >> $0) & 255) }
}
func chunk(_ name: String, _ value: [UInt8]) -> [UInt8] {
    let body = Array(name.utf8) + value
    let crc = body.withUnsafeBytes { crc32(0, $0.bindMemory(to: Bytef.self).baseAddress, uInt(body.count)) }
    return bigEndian(value.count) + body + bigEndian(Int(crc))
}
func paeth(_ a: Int, _ b: Int, _ c: Int) -> Int {
    let p = a+b-c, pa = abs(p-a), pb = abs(p-b), pc = abs(p-c)
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let input = [UInt8](try Data(contentsOf: url))
let signature: [UInt8] = [137,80,78,71,13,10,26,10]
try require(Array(input.prefix(8)) == signature, "Expected PNG")
var chunks: [(String,[UInt8])] = [], compressed: [UInt8] = [], offset = 8
while offset < input.count {
    try require(offset+12 <= input.count, "Truncated PNG")
    let length = u32(input, offset)
    try require(length <= input.count-offset-12, "Invalid PNG chunk")
    let body = Array(input[offset+4..<offset+8+length])
    let crc = body.withUnsafeBytes { crc32(0, $0.bindMemory(to: Bytef.self).baseAddress, uInt(body.count)) }
    try require(Int(crc) == u32(input,offset+8+length), "PNG CRC mismatch")
    let name = String(bytes: body.prefix(4), encoding: .ascii) ?? ""
    let value = Array(body.dropFirst(4))
    try require(!["acTL","fcTL","fdAT","tRNS"].contains(name), "Animated or transparent PNG unsupported")
    chunks.append((name,value))
    if name == "IDAT" { compressed += value }
    offset += length+12
}
try require(chunks.first?.0 == "IHDR" && chunks.last?.0 == "IEND", "Invalid PNG structure")
let header = chunks[0].1
try require(header.count == 13 && header[8] == 8 && header[9] == 6 && header[10...12].allSatisfy { $0 == 0 },
            "Only noninterlaced 8-bit RGBA PNG is reviewed")
let width = u32(header,0), height = u32(header,4)
try require(width == 1024 && height == 1024, "Expected 1024 App Store icon")
let rowBytes = width*4
var filtered = [UInt8](repeating:0,count:(rowBytes+1)*height)
var decodedSize = uLongf(filtered.count)
let result = filtered.withUnsafeMutableBytes { output in compressed.withUnsafeBytes { source in
    uncompress(output.bindMemory(to: Bytef.self).baseAddress, &decodedSize,
               source.bindMemory(to: Bytef.self).baseAddress, uLong(compressed.count))
} }
try require(result == Z_OK && decodedSize == filtered.count, "Invalid image data")
var rgba = [UInt8](repeating:0,count:rowBytes*height)
for y in 0..<height {
    let filter = Int(filtered[y*(rowBytes+1)])
    try require(filter <= 4, "Unknown PNG filter")
    for x in 0..<rowBytes {
        let a = x >= 4 ? Int(rgba[y*rowBytes+x-4]) : 0
        let b = y > 0 ? Int(rgba[(y-1)*rowBytes+x]) : 0
        let c = y > 0 && x >= 4 ? Int(rgba[(y-1)*rowBytes+x-4]) : 0
        let predictors = [0,a,b,(a+b)/2,paeth(a,b,c)]
        rgba[y*rowBytes+x] = UInt8((Int(filtered[y*(rowBytes+1)+x+1])+predictors[filter]) & 255)
    }
}
try require(stride(from:3,to:rgba.count,by:4).allSatisfy { rgba[$0] == 255 }, "Nonopaque pixel; artwork review required")
var rgbRows = [UInt8](); rgbRows.reserveCapacity((width*3+1)*height)
for y in 0..<height {
    rgbRows.append(0)
    for x in 0..<width { rgbRows += rgba[(y*width+x)*4..<(y*width+x)*4+3] }
}
var size = compressBound(uLong(rgbRows.count))
var encoded = [UInt8](repeating:0,count:Int(size))
let status = encoded.withUnsafeMutableBytes { output in rgbRows.withUnsafeBytes { source in
    compress2(output.bindMemory(to: Bytef.self).baseAddress,&size,
              source.bindMemory(to: Bytef.self).baseAddress,uLong(rgbRows.count),Z_BEST_COMPRESSION)
} }
try require(status == Z_OK, "PNG compression failed")
var output = signature, wroteData = false
for (name, value) in chunks {
    var value = value
    if name == "IHDR" { value[9] = 2 }
    if name == "sBIT" {
        try require(value.count == 4, "Invalid sBIT")
        value.removeLast()
    }
    if name == "IDAT" {
        if !wroteData { output += chunk(name,Array(encoded.prefix(Int(size)))); wroteData = true }
    } else { output += chunk(name,value) }
}
try Data(output).write(to:url,options:.atomic)
print("Retained all 1024x1024 RGB samples and ancillary profile chunks; removed only opaque alpha")
