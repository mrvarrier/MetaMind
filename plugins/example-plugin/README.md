# Example MetaMind Plugin

This is an example plugin that demonstrates the capabilities of the MetaMind plugin system.

## Features

- **File Processing**: Analyzes text files (.txt, .md) for importance and keywords
- **Search Enhancement**: Enhances search queries with priority modifiers
- **UI Components**: Adds a custom panel to the right sidebar
- **Notifications**: Shows notifications for important files
- **Custom Analysis**: Provides keyword extraction and text summarization

## Plugin Structure

```
example-plugin/
├── plugin.json          # Plugin manifest
├── index.js             # Main plugin code
├── README.md            # This file
└── components/          # UI components (if any)
```

## API Usage

The plugin demonstrates usage of various MetaMind APIs:

### File Analysis
```javascript
const analysis = await this.api.analyzeFile(file.path);
```

### Notifications
```javascript
await this.api.showNotification(title, message);
```

### Search
```javascript
const results = await this.api.searchFiles(query);
```

## Hooks

The plugin registers for these hooks:

- `FileProcessed`: Called when a file is processed by MetaMind
- `SearchStarted`: Called when a search is initiated

## Permissions

Required permissions:
- `FileRead`: Read file contents
- `FileAnalysis`: Analyze files with AI
- `NotificationSend`: Send notifications to user
- `UIRender`: Render custom UI components

## Installation

This plugin is included as an example. To install custom plugins:

1. Create a plugin directory in `plugins/`
2. Add a `plugin.json` manifest file
3. Implement the plugin logic
4. Restart MetaMind to load the plugin

## Development

### Plugin Manifest (plugin.json)

The manifest defines the plugin's metadata, hooks, permissions, and components:

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example plugin",
  "hooks": [...],
  "permissions": [...],
  "ui_components": [...]
}
```

### Plugin Class

Implement a plugin class with hook methods:

```javascript
class MyPlugin {
  async onFileProcessed(context, data) {
    // Handle file processing
  }
  
  onSearchStarted(context, data) {
    // Handle search start
  }
}
```

### Plugin API

The plugin API provides access to MetaMind functionality:

- `api.analyzeFile(path)` - Analyze a file
- `api.searchFiles(query)` - Search files
- `api.showNotification(title, message)` - Show notification
- More APIs available based on permissions

## Best Practices

1. **Error Handling**: Always wrap API calls in try-catch
2. **Performance**: Keep hook functions lightweight
3. **Permissions**: Request only needed permissions
4. **Logging**: Use console.log with plugin name prefix
5. **Cleanup**: Implement cleanup method for resource management

## Example Use Cases

- Custom file type processors
- Integration with external services
- Custom search providers
- UI enhancements
- Workflow automation
- Analytics and reporting

## Troubleshooting

Common issues:

1. **Plugin not loading**: Check plugin.json syntax
2. **Permission errors**: Ensure required permissions are declared
3. **API errors**: Check API method signatures and parameters
4. **Hook not called**: Verify hook type and function name in manifest