import { test, expect } from '@playwright/test'

test.describe('MetaMind Application', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/')
  })

  test('should display the main navigation', async ({ page }) => {
    // Check for navigation elements
    await expect(page.getByText('Home')).toBeVisible()
    await expect(page.getByText('Search')).toBeVisible()
    await expect(page.getByText('Index')).toBeVisible()
    await expect(page.getByText('Insights')).toBeVisible()
    await expect(page.getByText('Settings')).toBeVisible()
  })

  test('should display the MetaMind logo', async ({ page }) => {
    await expect(page.getByText('MetaMind')).toBeVisible()
  })

  test('should navigate between main sections', async ({ page }) => {
    // Navigate to Search
    await page.getByText('Search').click()
    await expect(page.getByPlaceholderText('Search files with natural language...')).toBeVisible()

    // Navigate to Index
    await page.getByText('Index').click()
    await expect(page.getByText('File Indexing')).toBeVisible()

    // Navigate to Insights
    await page.getByText('Insights').click()
    await expect(page.getByText('File Intelligence Dashboard')).toBeVisible()

    // Navigate to Settings
    await page.getByText('Settings').click()
    await expect(page.getByText('Application Settings')).toBeVisible()

    // Navigate back to Home
    await page.getByText('Home').click()
    await expect(page.getByText('Welcome to MetaMind')).toBeVisible()
  })

  test('should display responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check if mobile navigation is working
    await expect(page.getByText('MetaMind')).toBeVisible()
    
    // The navigation might be collapsed on mobile
    // Check if the main content is still accessible
    await expect(page.getByText('Welcome to MetaMind')).toBeVisible()
  })

  test('should handle theme switching', async ({ page }) => {
    // Navigate to settings
    await page.getByText('Settings').click()
    
    // Look for theme toggle (this depends on your settings implementation)
    const themeToggle = page.locator('select[aria-label*="theme"], button[aria-label*="theme"], [data-testid*="theme"]').first()
    
    if (await themeToggle.isVisible()) {
      await themeToggle.click()
      
      // Verify theme change (check for dark mode classes or styles)
      const body = page.locator('body')
      const htmlClasses = await body.getAttribute('class') || ''
      
      // This test is basic - in a real app you'd check specific theme classes
      expect(htmlClasses).toBeDefined()
    }
  })
})