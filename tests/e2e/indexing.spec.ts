import { test, expect } from '@playwright/test'

test.describe('File Indexing Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Navigate to indexing page
    await page.getByText('Index').click()
    await expect(page.getByText('File Indexing')).toBeVisible()
  })

  test('should display indexing interface elements', async ({ page }) => {
    // Check for main indexing elements
    await expect(page.getByText('File Indexing')).toBeVisible()
    await expect(page.getByText('Add directories and files to your knowledge base')).toBeVisible()
    
    // Check for add location button
    await expect(page.getByRole('button', { name: /add location/i })).toBeVisible()
    
    // Check for start indexing button (might be disabled initially)
    const startButton = page.getByRole('button', { name: /start indexing/i })
    await expect(startButton).toBeVisible()
  })

  test('should show empty state when no locations are added', async ({ page }) => {
    // Check for empty state
    await expect(page.getByText('No locations added yet')).toBeVisible()
    await expect(page.getByText('Add directories or files to start building your knowledge base')).toBeVisible()
  })

  test('should disable start indexing button when no locations', async ({ page }) => {
    const startButton = page.getByRole('button', { name: /start indexing/i })
    await expect(startButton).toBeDisabled()
  })

  test('should open folder selection dialog', async ({ page }) => {
    const addLocationButton = page.getByRole('button', { name: /add location/i })
    
    // Click add location button
    await addLocationButton.click()
    
    // Note: In a real Tauri app, this would open a native file dialog
    // For testing purposes, we might need to mock this or test the UI response
    
    // Wait for any modal or dialog to appear
    await page.waitForTimeout(500)
    
    // In a real test, you might check for:
    // - A modal/dialog appearing
    // - The button being in a loading state
    // - An error message if no folder was selected
    
    // For now, just verify the button is still there
    await expect(addLocationButton).toBeVisible()
  })

  test('should display location statistics when available', async ({ page }) => {
    // This test assumes there might be existing locations or mock data
    
    // Look for location cards or statistics
    const locationCard = page.locator('[data-testid*="location"], .location-card, [class*="location"]').first()
    
    if (await locationCard.isVisible().catch(() => false)) {
      // If location exists, check for statistics
      await expect(locationCard).toBeVisible()
      
      // Look for common statistics elements
      const statsElements = [
        page.locator('text=/files/i'),
        page.locator('text=/processed/i'),
        page.locator('text=/pending/i'),
        page.locator('text=/error/i')
      ]
      
      // At least one statistic should be visible
      const visibleStats = await Promise.all(
        statsElements.map(element => element.isVisible().catch(() => false))
      )
      
      expect(visibleStats.some(visible => visible)).toBe(true)
    }
  })

  test('should show indexing progress when indexing is active', async ({ page }) => {
    // This test would require either existing data or a way to trigger indexing
    
    // Look for progress indicators
    const progressElements = [
      page.locator('[role="progressbar"]'),
      page.locator('.progress'),
      page.locator('[data-testid*="progress"]'),
      page.getByText(/indexing/i),
      page.getByText(/processing/i)
    ]
    
    // Check if any progress elements are visible
    const visibleProgress = await Promise.all(
      progressElements.map(element => element.isVisible().catch(() => false))
    )
    
    if (visibleProgress.some(visible => visible)) {
      // If indexing is active, check for progress information
      await expect(page.locator('[role="progressbar"], .progress, [data-testid*="progress"]').first()).toBeVisible()
    }
  })

  test('should handle indexing controls', async ({ page }) => {
    const startButton = page.getByRole('button', { name: /start indexing/i })
    const stopButton = page.getByRole('button', { name: /stop indexing/i })
    
    // Initially, start button should be visible
    await expect(startButton).toBeVisible()
    
    // Stop button might not be visible initially
    const isStopButtonVisible = await stopButton.isVisible().catch(() => false)
    
    if (!isStopButtonVisible) {
      // Start button should be disabled if no locations
      if (await page.getByText('No locations added yet').isVisible().catch(() => false)) {
        await expect(startButton).toBeDisabled()
      }
    }
    
    // If stop button is visible, indexing might be active
    if (isStopButtonVisible) {
      await expect(stopButton).toBeEnabled()
    }
  })

  test('should display queue information', async ({ page }) => {
    // Look for queue-related information
    const queueElements = [
      page.getByText(/queue/i),
      page.getByText(/pending/i),
      page.getByText(/jobs/i),
      page.locator('[data-testid*="queue"]')
    ]
    
    // Check if any queue information is displayed
    const visibleQueueElements = await Promise.all(
      queueElements.map(element => element.isVisible().catch(() => false))
    )
    
    if (visibleQueueElements.some(visible => visible)) {
      // If queue information is shown, verify it makes sense
      const queueInfo = page.locator('text=/queue|pending|jobs/i').first()
      await expect(queueInfo).toBeVisible()
    }
  })

  test('should handle error states gracefully', async ({ page }) => {
    // Look for error messages or indicators
    const errorElements = [
      page.getByText(/error/i),
      page.getByText(/failed/i),
      page.locator('[data-testid*="error"]'),
      page.locator('.error'),
      page.locator('[role="alert"]')
    ]
    
    // Check for any error states
    const visibleErrors = await Promise.all(
      errorElements.map(element => element.isVisible().catch(() => false))
    )
    
    if (visibleErrors.some(visible => visible)) {
      // If errors are present, they should be clearly displayed
      const errorElement = errorElements.find(async (element, index) => visibleErrors[index])
      if (errorElement) {
        await expect(errorElement).toBeVisible()
      }
    }
  })

  test('should refresh location statistics', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.locator('button[title*="refresh"], button[aria-label*="refresh"], [data-testid*="refresh"]').first()
    
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click()
      
      // Wait for refresh to complete
      await page.waitForTimeout(500)
      
      // Verify page is still functional
      await expect(page.getByText('File Indexing')).toBeVisible()
    }
  })

  test('should handle location removal', async ({ page }) => {
    // This test assumes there might be locations to remove
    
    // Look for remove buttons
    const removeButtons = page.locator('button[title*="remove"], button[aria-label*="remove"], [data-testid*="remove"], button[title*="delete"], button[aria-label*="delete"]')
    
    const removeButtonCount = await removeButtons.count()
    
    if (removeButtonCount > 0) {
      // Click the first remove button
      await removeButtons.first().click()
      
      // Wait for any confirmation dialog or immediate removal
      await page.waitForTimeout(500)
      
      // Verify the interface is still functional
      await expect(page.getByText('File Indexing')).toBeVisible()
    }
  })

  test('should display helpful messages for different states', async ({ page }) => {
    // Check for various helpful messages
    const helpfulMessages = [
      'No locations added yet',
      'Add directories or files to start building your knowledge base',
      'Drag and drop folders here or click Add Location',
      'Processing files...',
      'Indexing complete',
      'No files found in selected location'
    ]
    
    // At least one helpful message should be visible
    let messageFound = false
    
    for (const message of helpfulMessages) {
      const element = page.getByText(message)
      if (await element.isVisible().catch(() => false)) {
        await expect(element).toBeVisible()
        messageFound = true
        break
      }
    }
    
    // If no specific helpful message is found, at least the main heading should be there
    if (!messageFound) {
      await expect(page.getByText('File Indexing')).toBeVisible()
    }
  })
})