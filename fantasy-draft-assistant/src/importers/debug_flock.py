from playwright.sync_api import sync_playwright

URL = "https://flockfantasy.com/rankings?format=BEST_BALL"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)

    page = browser.new_page()

    page.goto(URL, wait_until="domcontentloaded")

    print("Browser opened.")
    print("Press F12 to open Developer Tools.")
    print("Go to the Network tab, then click Fetch/XHR.")
    print("Refresh the page (Ctrl+R).")
    print("Press Enter here when you're done...")

    input()

    browser.close()