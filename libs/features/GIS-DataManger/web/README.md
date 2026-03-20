
# GIS Data Manager UI Components

This library contains the frontend components for the GIS Data Manager feature.

## Components

### `<GisDataManager />`

The main entry point component that orchestrates the data management interface.
It handles:
- Fetching and displaying the dataset list
- Managing the upload modal state
- Calculating storage statistics
- Displaying system notifications

### `<DatasetTable />`

Displays a list of datasets in a table format.

**Props:**
- `data`: Array of `Dataset` objects
- `loading`: Boolean loading state
- `onView`: Callback for view action
- `onDelete`: Callback for delete action
- `onCopy`: Callback for copy action
- `onDownload`: Callback for download action

### `<UploadModal />`

A dialog for uploading new GIS datasets.

**Props:**
- `open`: Boolean state for visibility
- `onOpenChange`: Callback to change visibility
- `projectId`: ID of the project to upload to
- `onUploadSuccess`: Callback triggered after successful upload

### `<StorageCard />`

Displays storage usage statistics.

**Props:**
- `stats`: Object containing `totalSpace`, `usedSpace`, and `usagePercent`

### `<NotificationList />`

Displays a list of recent system notifications.

**Props:**
- `notifications`: Array of notification objects

## Usage

```tsx
import { GisDataManager } from '@txwx-monorepo/gis-data-manger';

function App() {
  return <GisDataManager />;
}
```

## Dependencies

- shadcn/ui (Button, Dialog, Input, Label, Progress, Table, Card)
- lucide-react (Icons)
- react-dropzone (File upload)
