import XCTest

// Run on a dedicated, unsigned-in simulator after installing the native app and
// opening https://www.facebook.com/messages/ with simctl openurl. No messages sent.
final class FacefixUITests: XCTestCase {
    func testSafariDesktopIdentity() throws {
        continueAfterFailure = false
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.terminate()
        safari.launch()
        allowCurrentWebsite(safari)
        if safari.textFields["URL"].exists && safari.buttons["Cancel"].exists { safari.buttons["Cancel"].tap() }
        if safari.toolbars.buttons["Done"].exists { safari.toolbars.buttons["Done"].tap() }
        if safari.buttons["Continue"].waitForExistence(timeout: 3) { safari.buttons["Continue"].tap() }
        if safari.buttons["Not Now"].exists { safari.buttons["Not Now"].tap() }
        if safari.buttons["Close"].exists { safari.buttons["Close"].tap() }
        let menu = safari.buttons["PageFormatMenuButton"]
        XCTAssertTrue(menu.waitForExistence(timeout: 15), safari.debugDescription)
        let extensionName = "Facefix — Keep My Place"
        let toggle = safari.switches[extensionName]
        if !toggle.exists {
            menu.tap()
            if safari.buttons["NotNowButton"].exists { safari.buttons["NotNowButton"].tap() }
            let manage = safari.staticTexts["Manage Extensions"]
            XCTAssertTrue(manage.waitForExistence(timeout: 5), safari.debugDescription)
            manage.tap()
        }
        XCTAssertTrue(toggle.waitForExistence(timeout: 5), safari.debugDescription)
        if toggle.value as? String == "0" { toggle.tap() }
        safari.buttons["Done"].tap()
        safari.terminate()
        safari.launch()
        menu.tap()
        let entry = safari.staticTexts[extensionName].firstMatch
        XCTAssertTrue(entry.waitForExistence(timeout: 10), safari.debugDescription)
        entry.tap()
        allowCurrentWebsite(safari)
        let openMessages = safari.buttons["Open Messages"]
        XCTAssertTrue(openMessages.waitForExistence(timeout: 15), safari.debugDescription)
        XCTAssertTrue(openMessages.isEnabled, safari.debugDescription)
        attach("Initialized Facefix", app: safari)
        // Start the supported user flow after granting access. The pre-grant
        // tab may already have redirected to an unrelated mobile login page.
        openMessages.tap()
        allowCurrentWebsite(safari)
        if safari.toolbars.buttons["Done"].exists { safari.toolbars.buttons["Done"].tap() }
        XCTAssertTrue(menu.waitForExistence(timeout: 15))
        menu.tap()
        XCTAssertTrue(entry.waitForExistence(timeout: 10))
        entry.tap()
        let help = safari.buttons["Messenger help"]
        XCTAssertTrue(help.waitForExistence(timeout: 10), safari.debugDescription)
        help.tap()
        safari.buttons["Check This Tab"].tap()
        let result = safari.staticTexts["Desktop identity is active on this page."]
        let activeIdentity = result.waitForExistence(timeout: 15)
        if !activeIdentity {
            attach("Unexpected Identity", app: safari)
            if safari.buttons["Done"].exists { safari.buttons["Done"].tap() }
            let address = safari.textFields["TabBarItemTitle"]
            if address.exists {
                address.tap()
                print("QA unsigned-in landing URL: \(safari.textFields["URL"].value ?? "unknown")")
            }
        }
        XCTAssertTrue(activeIdentity, safari.debugDescription)
        attach("Desktop Identity Active", app: safari)
    }

    private func allowCurrentWebsite(_ safari: XCUIApplication) {
        let allow = safari.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Always Allow")).firstMatch
        if allow.waitForExistence(timeout: 4) { allow.tap() }
        let websiteOnly = safari.buttons["Always Allow on This Website"]
        if websiteOnly.waitForExistence(timeout: 4) { websiteOnly.tap() }
    }

    private func attach(_ name: String, app: XCUIApplication) {
        let image = XCTAttachment(screenshot: app.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
    }
}
