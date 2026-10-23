import { expect, test } from "@playwright/test";

async function register(page: import("@playwright/test").Page) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const user = {
    username: `webtest${suffix}`,
    email: `webtest${suffix}@example.test`,
    password: "password123"
  };
  await page.goto("/register");
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await Promise.all([
    page.waitForURL("/"),
    page.click('button[type="submit"]')
  ]);
  return user;
}

test("renders public navigation and protects the editor", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("nav.navbar")).toBeVisible();
  await expect(page.locator("a.navbar-brand")).toHaveText("conduit");
  await expect(page.locator('a[href="/login"]')).toBeVisible();
  await expect(page.locator('a[href="/register"]')).toBeVisible();
  await page.goto("/editor");
  await expect(page).toHaveURL("/login");
  await page.goto("/?feed=following");
  await expect(page).toHaveURL("/login");
});

test("registers a user and restores the session after reload", async ({ page }) => {
  const user = await register(page);
  await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__conduit_debug__?.getAuthState())).toBe("authenticated");
  const token = await page.evaluate(() => window.__conduit_debug__?.getToken());
  expect(token).toBeTruthy();
  await page.reload();
  await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__conduit_debug__?.getCurrentUser()?.username)).toBe(user.username);
  await page.goto("/?feed=following");
  await expect(page.locator(".empty-feed-message")).toContainText("Your feed is empty");
  await expect(page.locator('.empty-feed-message a[href="/"]')).toBeVisible();
});

test("creates, edits, comments on, and deletes an article", async ({ page }) => {
  const user = await register(page);
  const suffix = Date.now();
  const title = `Browser Article ${suffix}`;
  await page.goto("/editor");
  await page.fill('input[name="title"]', title);
  await page.fill('input[name="description"]', "Created in a browser test");
  await page.fill('textarea[name="body"]', "Article body shown on the detail page.");
  await page.fill('input[placeholder="Enter tags"]', "browser-test");
  await page.press('input[placeholder="Enter tags"]', "Enter");
  await page.click('button:has-text("Publish Article")');
  await expect(page).toHaveURL(/\/article\/.+/);
  await expect(page.locator(".article-page h1")).toHaveText(title);
  await expect(page.locator(".article-content p")).toContainText("Article body shown");
  await expect(page.locator(".tag-list .tag-default")).toContainText("browser-test");

  await page.goto("/");
  await page.locator(".article-preview h1").filter({ hasText: title }).click();
  await expect(page).toHaveURL(/\/article\/.+/);
  await expect(page.locator("h1")).toHaveText(title);

  await page.fill('textarea[placeholder="Write a comment..."]', "A test comment");
  await page.click('button:has-text("Post Comment")');
  await expect(page.locator(".card:not(.comment-form) .card-block")).toContainText("A test comment");

  await page.click('a:has-text("Edit Article")');
  const updatedTitle = `Updated Browser Article ${suffix}`;
  await page.fill('input[name="title"]', updatedTitle);
  await page.click('button:has-text("Publish Article")');
  await expect(page.locator(".article-page h1")).toHaveText(updatedTitle);

  await page.click('button:has-text("Delete Article")');
  await expect(page).toHaveURL("/");
  await expect(page.locator(`.article-preview h1:has-text("${updatedTitle}")`)).toHaveCount(0);
  await expect(page.locator(`a[href="/profile/${user.username}"]`)).toBeVisible();
});

test("shows backend errors for invalid login", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "missing@example.test");
  await page.fill('input[name="password"]', "wrongpassword");
  await page.click('button[type="submit"]');
  await expect(page.locator(".error-messages")).toBeVisible();
  await expect(page).toHaveURL("/login");
});
