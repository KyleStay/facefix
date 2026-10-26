import XCTest

// Run on a dedicated, unsigned-in simulator after installing the native app and
// opening https://www.facebook.com/messages/ with simctl openurl. No messages sent.
final class FacefixUITests: XCTestCase {
    func testSafariDesktopIdentity() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        if safari.buttons["Continue"].waitForExistence(timeout: 3) { safari.buttons["Continue"].tap() }
        if safari.buttons["Not Now"].exists { safari.buttons["Not Now"].tap() }
        if safari.buttons["Close"].exists { safari.buttons["Close"].tap() }
        let menu = safari.buttons["PageFormatMenuButton"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15), safari.debugDescription)
        menu.tap()
        if safari.buttons["NotNowButton"].exists { safari.buttons["NotNowButton"].tap() }
        let manage = safari.staticTexts["Manage Extensions"]
        XCTAssertTrue(manage.waitForExistence(timeout: 5), safari.debugDescription)
        manage.tap()
        let toggle = safari.switches["Facefix"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 5), safari.debugDescription)
        if toggle.value as? String == "0" { toggle.tap() }
        safari.buttons["Done"].tap()
        safari.terminate()
        safari.launch()
        menu.tap()
        let entry = safari.staticTexts["Facefix"].firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 10), safari.debugDescription)
        entry.tap()
        let allow = safari.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Always Allow")).firstMatch
        if allow.waitForExistence(timeout: 4) { allow.tap() }
        let websiteOnly = safari.buttons["Always Allow on This Website"]
        if websiteOnly.waitForExistence(timeout: 4) { websiteOnly.tap() }
        let openMessages = safari.buttons["Open Messages"]
        XCTAssertTrue(openMessages.waitForExistence(timeout: 15), safari.debugDescription)
        XCTAssertTrue(openMessages.isEnabled, safari.debugDescription)
        attach("Initialized Facefix", app: safari)
        safari.buttons["Reload This Tab"].tap()
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        menu.tap()
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        entry.tap()
        let help = safari.buttons["Messenger help"]
        XCTAssertTrue(help.waitForExistence(timeout: 10), safari.debugDescription)
        help.tap()
        safari.buttons["Check This Tab"].tap()
        let result = safari.staticTexts["Desktop identity is active on this page."]
        XCTAssertTrue(result.waitForExistence(timeout: 15), safari.debugDescription)
        attach("Desktop Identity Active", app: safari)
    }

    private func attach(_ name: String, app: XCUIApplication) {
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
    }
}
