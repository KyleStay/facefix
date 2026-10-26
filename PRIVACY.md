# Facefix Privacy Policy

Effective date: October 26, 2026

Facefix — Keep My Place is a browser extension for Chromium and Safari maintained by Kyle Stay. It reduces unwanted Facebook refreshes, Home redirects, and scroll jumps. The Safari version also opens web messaging with a desktop browser identity, adapts recognized chat layouts to a phone, and hides explicit Facebook and Messenger app promotions.

## Information processed on your device

Facefix checks Facebook tab URLs and navigation destinations to decide where protection applies and whether an automatic Home redirect should be blocked. It observes page visibility, focus, page restoration, scroll position, and the occurrence of clicks, keys, wheel, pointer, and touch events so that protection can end when you interact with the page. It does not record the text of keys you press or the contents of forms.

Tab identifiers, the current navigation URL, scroll position, and short-lived protection state are used in memory. To recover your place after feed changes, Facefix also inspects visible feed article positions and post permalink links. It temporarily retains a visible post link and its onscreen offset in memory, matches that link if Facebook rerenders the post, and clears this anchor when recovery ends, you interact with the page, or protection is disabled. It does not read post text for this recovery. Facefix does not save a URL history or associate its counters with a particular page or person.

To hide explicit Facebook and Messenger app promotions, Facefix checks link destinations, visible or accessibility labels, and the size and position of promotion containers outside recognized posts, forms, editable fields, navigation, and dialogs. Dedicated promotion controls and their otherwise empty pinned containers are hidden and restored when protection is paused. Containers with unrelated controls or content are retained. These labels and destinations are processed transiently, never saved or transmitted. Browser-owned app banners and prompts remain under browser control.

In Safari, Facefix uses scripting and request-rule permissions on supported Facebook and Messenger websites. It changes the browser identity sent with messaging requests, redirects supported messaging routes to the desktop website, and adjusts page-visible identity values on messaging and related login routes. It inspects chat navigation links, composer element structure, viewport settings, and layout dimensions to fit recognized chat panes to a phone. It does not read, save, or transmit draft or message text. The optional **Check This Tab** control reads the active page’s browser identity and displays the result locally; it does not retain it. Pausing protection restores owned page changes and disables messaging rules; reload open pages to reset any identity already sent to a website.

## Information saved locally

Facefix saves the protection on/off setting, the local-recording preference, and four aggregate diagnostic totals in the browser’s extension-local storage: return events suppressed, reloads blocked, Home redirects blocked, and scroll recoveries. These totals are combined across Facebook tabs. They contain no URLs, timestamps, post contents, account identifiers, or personal messages. Facefix does not use Chrome Sync for these settings or counters.

The popup live timer view reads remaining Facefix protection durations, whether the page is away or unfocused, whether a post is matched for recovery, and why a protection window ended. It also checks the installed, page-connection, and guard versions. Facebook's own internal refresh timers are not accessed. These readings stay within your browser; selected status fields can be saved when you request a failure report.

Automatic local diagnostic recording is on by default and can be turned off independently of protection. Its bounded history records fixed event categories, event timestamps, browser-local tab and document identifiers, numeric scroll/layout/timing measurements, interaction categories (such as wheel or keydown, never key text), navigation categories (such as reload, never destinations), post-match/recovery flags, page-load/discard information, and browser capability flags. At most 300 events and 120 events per document per minute are accepted. No page or post URLs, post text, key text, messages, account identifiers, cookies, screenshots, or raw error messages enter these records.

When you select **Something went wrong** or **Capture failure report**, Facefix saves a snapshot with its version and connection checks, protection timers and flags, browser capability and memory-protection status, aggregate counters, findings, and up to 120 recent events from the selected tab in the last 30 minutes. At most five reports are retained. Reports distinguish observations, possible causes, and unknown causes. These are troubleshooting records, not proof that Facebook caused a change or a tamper-proof audit log.

## How information is used

This information is used only to provide the extension's protection, display its controls and counters, investigate failures, and keep your settings between browser sessions. On browsers exposing the auto-discard setting, Facefix asks the browser to keep protected Facebook tabs in memory. This may use more memory. Safari does not expose that setting; Facefix cannot prevent Safari from unloading tabs.

Facefix does not save post text, private messages, contacts, passwords, cookies, payment information, or account profile details. Visible post links are used only for the temporary position recovery described above. Its permission to run on supported Facebook and Messenger websites allows it to work with page events and navigation; it is not used to build a profile of you.

## Transmission and sharing

Facefix has no developer-operated server, analytics service, advertising service, or remote-code loader. The extension makes no network requests to transmit the information described above. It does not sell data, automatically share it with third parties, or use it for advertising, credit decisions, or unrelated purposes. **Export latest report** creates a JSON file on your device. You decide whether to share it; review it before doing so. An export contains diagnostic timestamps and browser-local identifiers. Exported copies are outside the extension's retention controls. Internal messages between the extension's page scripts and background worker stay within your browser.

Your normal Facebook and Messenger traffic remains subject to Facebook's policies. Chrome’s extension distribution and update services are operated by Google. Safari’s app distribution and update services are operated by Apple. If you visit the GitHub repository or voluntarily submit an issue, GitHub processes that visit and any information you submit under its own policies. Public issues can be read by others; do not include private Facebook content, credentials, or sensitive personal information.

## Retention and your controls

The settings and counters remain in the browser’s local extension storage until you change or clear them or uninstall the extension. Use **Reset counters** in the toolbar popup to clear the four totals. Turn off **Facebook protection** to stop protection and further counter increments. Uninstalling Facefix removes its extension-local storage. Reload open Facebook and Messenger pages after uninstalling to remove scripts already running in those pages. In-memory protection state ends when the page is closed or reloaded.

Diagnostic events and reports expire after 24 hours and are removed when Facefix next records or reviews diagnostics; expiry is not a background deletion alarm. Turn off **Record local event history** to stop new automatic records. Existing records remain until expiry or **Clear history and reports** removes them. Turning recording off still allows a manually requested report. Clearing diagnostic history preserves the aggregate counters and settings. Turning protection off does not turn diagnostic recording off; they have separate controls. No Chrome Sync is used for diagnostic history or reports.

## Limited use

Facefix's use of information received from Chrome APIs follows the Chrome Web Store User Data Policy, including its Limited Use requirements. Information is used only for the user-facing functionality described here.

## Changes and contact

This policy may be updated when Facefix's behavior changes. The effective date above identifies this version. For privacy questions, contact the maintainer through the [Facefix GitHub issue tracker](https://github.com/KyleStay/facefix/issues). Please keep public reports free of sensitive personal information.
