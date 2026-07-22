from playwright.sync_api import sync_playwright

URL = "https://www.4for4.com/adp"


with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)

    page = browser.new_page()

    page.goto(URL)

    page.pause()

    browser.close()