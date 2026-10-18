import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('TEST-084/085 connected preview is responsive, keyboard reachable and has no automated a11y violations',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.getByText('Configuration loaded')).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  await page.keyboard.press('Tab');await expect(page.getByText('Skip to content')).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);expect(errors).toEqual([]);
});
test('TEST-088 network failure is retryable without fake success',async({page})=>{
  await page.route('**/api/v1/meta/config',route=>route.abort());await page.goto('/');await expect(page.getByRole('button',{name:'Try again'})).toBeVisible();await expect(page.getByText('Configuration loaded')).toHaveCount(0);
  await page.unroute('**/api/v1/meta/config');await page.getByRole('button',{name:'Try again'}).click();await expect(page.getByText('Configuration loaded')).toBeVisible();
});
test('TEST-086/088 system pages have static reduced-motion equivalents and truthful copy',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const path of ['/403','/404','/500','/session-expired','/maintenance','/unknown']) {await page.goto(path);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);await expect(page.getByRole('link',{name:'Return to overview'})).toBeVisible();}
  expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
});
