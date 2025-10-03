# MyYachtValue

## Operations

### Verifying Deployed Builds

To verify which version of the application is currently deployed, view the page source in your browser. At the end of the HTML document, you will find a build stamp comment in the format:

```html
<!-- MYV Build: <short-git-sha> @ <ISO-timestamp> -->
```

This comment includes:
- **Short Git SHA**: The commit hash from which the build was created
- **Build Timestamp**: The exact date and time when the build was generated (in ISO 8601 format)

Additionally, when running in production mode, the browser console will log the build metadata on startup:
```
MYV build <short-git-sha> <ISO-timestamp>
```
