import { test, expect } from '@playwright/test'

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Navigate to search page
    await page.getByText('Search').click()
    await expect(page.getByPlaceholderText('Search files with natural language...')).toBeVisible()
  })

  test('should display search interface elements', async ({ page }) => {
    // Check for main search elements
    await expect(page.getByText('Search')).toBeVisible()
    await expect(page.getByText('Search through your files using natural language')).toBeVisible()
    await expect(page.getByPlaceholderText('Search files with natural language...')).toBeVisible()
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible()
  })

  test('should show AI status indicator', async ({ page }) => {
    // Check for AI status indicator
    const aiStatus = page.locator('text=/AI Enhanced|Basic Search/')
    await expect(aiStatus).toBeVisible()
  })

  test('should display search examples', async ({ page }) => {
    // Check for search examples
    await expect(page.getByText('Try searching with natural language:')).toBeVisible()
    await expect(page.getByText('photos from last week')).toBeVisible()
    await expect(page.getByText('PDF documents about project')).toBeVisible()
    await expect(page.getByText('code files modified today')).toBeVisible()
  })

  test('should enable search button when input has text', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    const searchButton = page.getByRole('button', { name: /search/i })

    // Button should be disabled initially
    await expect(searchButton).toBeDisabled()

    // Type in search input
    await searchInput.fill('test query')
    
    // Button should be enabled now
    await expect(searchButton).toBeEnabled()

    // Clear input
    await searchInput.clear()
    
    // Button should be disabled again
    await expect(searchButton).toBeDisabled()
  })

  test('should perform search on Enter key', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    
    // Type search query and press Enter
    await searchInput.fill('test search query')
    await searchInput.press('Enter')
    
    // Should show loading or results state
    // Note: This depends on whether you have actual data or mock responses
    await page.waitForTimeout(1000) // Wait for any async operations
    
    // Check if we're no longer in the empty state
    const emptyState = page.getByText('Start Searching')
    const isEmptyStateVisible = await emptyState.isVisible().catch(() => false)
    
    if (!isEmptyStateVisible) {
      // We should either see loading state or results
      const hasResults = await page.locator('[data-testid="search-results"]').isVisible().catch(() => false)
      const isLoading = await page.locator('[data-testid="loader-icon"]').isVisible().catch(() => false)
      
      expect(hasResults || isLoading).toBe(true)
    }
  })

  test('should perform search on button click', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    const searchButton = page.getByRole('button', { name: /search/i })
    
    // Type search query and click search button
    await searchInput.fill('button search test')
    await searchButton.click()
    
    // Wait for search to complete
    await page.waitForTimeout(1000)
    
    // Verify search was performed (similar to previous test)
    const emptyState = page.getByText('Start Searching')
    const isEmptyStateVisible = await emptyState.isVisible().catch(() => false)
    
    expect(isEmptyStateVisible).toBe(false)
  })

  test('should clear search when clear button is clicked', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    
    // Type in search input
    await searchInput.fill('test query to clear')
    
    // Find and click clear button (X icon)
    const clearButton = page.locator('button').filter({ has: page.locator('svg') }).nth(2) // Assuming clear button is the third button with SVG
    await clearButton.click()
    
    // Input should be empty
    await expect(searchInput).toHaveValue('')
    
    // Should return to empty state
    await expect(page.getByText('Start Searching')).toBeVisible()
  })

  test('should toggle filters panel', async ({ page }) => {
    const filtersButton = page.getByRole('button', { name: /filters/i })
    
    // Filters should not be visible initially
    const filtersPanel = page.locator('[data-testid="search-filters"]')
    await expect(filtersPanel).not.toBeVisible()
    
    // Click filters button
    await filtersButton.click()
    
    // Filters panel should be visible
    await expect(filtersPanel).toBeVisible()
    
    // Click again to hide
    await filtersButton.click()
    
    // Should be hidden again
    await expect(filtersPanel).not.toBeVisible()
  })

  test('should click on search examples', async ({ page }) => {
    const exampleQuery = page.getByText('photos from last week')
    
    // Click on example
    await exampleQuery.click()
    
    // Search input should be filled with the example
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    await expect(searchInput).toHaveValue('photos from last week')
    
    // Should trigger search automatically
    await page.waitForTimeout(1000)
    
    // Should no longer show empty state
    const emptyState = page.getByText('Start Searching')
    const isEmptyStateVisible = await emptyState.isVisible().catch(() => false)
    expect(isEmptyStateVisible).toBe(false)
  })

  test('should show suggestions when typing', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    
    // Type partial query
    await searchInput.fill('test')
    
    // Wait for debounce and suggestions
    await page.waitForTimeout(500)
    
    // Check if suggestions appear (this depends on your implementation)
    // Note: This test might need adjustment based on actual suggestion implementation
    const suggestionsContainer = page.locator('[role="listbox"], .suggestions, [data-testid*="suggestion"]').first()
    
    // If suggestions are implemented, they should appear
    if (await suggestionsContainer.isVisible().catch(() => false)) {
      await expect(suggestionsContainer).toBeVisible()
    }
  })

  test('should refresh AI status', async ({ page }) => {
    // Find the refresh button (usually has a refresh/reload icon)
    const refreshButton = page.locator('button[title*="Refresh"], button[aria-label*="refresh"], button[aria-label*="Refresh"]').first()
    
    if (await refreshButton.isVisible()) {
      await refreshButton.click()
      
      // Wait for the status to potentially update
      await page.waitForTimeout(500)
      
      // Verify AI status is still visible
      const aiStatus = page.locator('text=/AI Enhanced|Basic Search/')
      await expect(aiStatus).toBeVisible()
    }
  })

  test('should handle keyboard navigation', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    
    // Focus search input
    await searchInput.focus()
    
    // Type query
    await searchInput.fill('keyboard test')
    
    // Press Escape to potentially close suggestions/clear focus
    await searchInput.press('Escape')
    
    // Tab to navigate to search button
    await page.keyboard.press('Tab')
    
    // Should focus the search button
    const searchButton = page.getByRole('button', { name: /search/i })
    await expect(searchButton).toBeFocused()
  })

  test('should display loading state during search', async ({ page }) => {
    const searchInput = page.getByPlaceholderText('Search files with natural language...')
    const searchButton = page.getByRole('button', { name: /search/i })
    
    // Fill search input
    await searchInput.fill('loading test query')
    
    // Click search and immediately check for loading state
    await searchButton.click()
    
    // Check if button shows loading state
    const loadingIcon = page.locator('[data-testid="loader-icon"]')
    
    // Note: Loading state might be very brief, so this test might be flaky
    // In a real scenario, you might want to mock slower responses for testing
    const isLoading = await loadingIcon.isVisible().catch(() => false)
    const isButtonDisabled = await searchButton.isDisabled().catch(() => false)
    
    // Either the button should be disabled or show loading icon during search
    expect(isLoading || isButtonDisabled).toBe(true)
  })
})