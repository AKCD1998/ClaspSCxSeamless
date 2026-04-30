var SXCleanup = {
  getWorkspaceFolder: function(logger) {
    var userProperties = PropertiesService.getUserProperties();
    var folderId = userProperties.getProperty(SXConfig.WORKSPACE_FOLDER_PROPERTY_KEY);

    if (folderId) {
      try {
        return DriveApp.getFolderById(folderId);
      } catch (error) {
        SXLogger.warn(logger, 'workspace folder lookup', 'stored folder id is no longer valid');
      }
    }

    var folders = DriveApp.getFoldersByName(SXConfig.WORKSPACE_FOLDER_NAME);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(SXConfig.WORKSPACE_FOLDER_NAME);

    userProperties.setProperty(SXConfig.WORKSPACE_FOLDER_PROPERTY_KEY, folder.getId());
    SXLogger.info(logger, 'workspace folder id', folder.getId());

    return folder;
  },

  getPreviewArchiveFolder: function() {
    var folderId = String(SXConfig.PREVIEW_ARCHIVE_FOLDER_ID || '').trim();
    var resourceKey = String(SXConfig.PREVIEW_ARCHIVE_FOLDER_RESOURCE_KEY || '').trim();

    if (!folderId) {
      throw new Error('Preview archive folder id is not configured.');
    }

    if (resourceKey) {
      return DriveApp.getFolderByIdAndResourceKey(folderId, resourceKey);
    }

    return DriveApp.getFolderById(folderId);
  },

  cleanupStaleWorkspaceFiles: function(logger) {
    var folder = this.getWorkspaceFolder(logger);
    var cutoffTime = new Date().getTime() - (SXConfig.OUTPUT_RETENTION_HOURS * 60 * 60 * 1000);
    var files = folder.getFiles();
    var deletedCount = 0;

    while (files.hasNext()) {
      var file = files.next();
      if (file.getDateCreated().getTime() >= cutoffTime) {
        continue;
      }

      file.setTrashed(true);
      deletedCount += 1;
    }

    if (deletedCount > 0) {
      SXLogger.info(logger, 'cleaned stale workspace files', deletedCount);
    }
  },

  trashFileById: function(fileId, logger) {
    try {
      DriveApp.getFileById(fileId).setTrashed(true);
    } catch (error) {
      SXLogger.warn(logger, 'temp cleanup skipped', error.message);
    }
  }
};
