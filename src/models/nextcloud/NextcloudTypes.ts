export interface NextcloudFile {
  path: string;
  name: string;
  contentType: string;
  size: number;
  lastModified?: string;
  fileId?: string;
}
