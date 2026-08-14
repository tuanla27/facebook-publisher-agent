import test from "node:test";
import assert from "node:assert/strict";
import { findDriveFolderByName, resolveImageRefs } from "../backend/sources/google-drive-reader.mjs";

function mockDrive({ folders = {}, files = {} } = {}) {
  return {
    files: {
      list: async ({ q }) => {
        if (!q) return { data: { files: [] } };
        // folder-by-name query
        if (q.includes("mimeType='application/vnd.google-apps.folder'")) {
          const nameMatch = q.match(/name='([^']+)'/);
          const parentMatch = q.match(/'([^']+)' in parents/);
          const name = nameMatch ? nameMatch[1] : null;
          const parent = parentMatch ? parentMatch[1] : null;
          const folder = folders[`${parent}/${name}`] || folders[name];
          return { data: { files: folder ? [folder] : [] } };
        }
        // file-by-name query (mimeType contains 'image/' + name=...)
        if (q.includes("mimeType contains 'image/'") && q.includes("name=")) {
          const nameMatch = q.match(/name='([^']+)'/);
          const parentMatch = q.match(/'([^']+)' in parents/);
          const name = nameMatch ? nameMatch[1] : null;
          const parent = parentMatch ? parentMatch[1] : null;
          const list = files[parent] || [];
          const found = list.find((f) => f.name === name);
          return { data: { files: found ? [found] : [] } };
        }
        // list images in folder (no name filter)
        if (q.includes("mimeType contains 'image/'")) {
          const parentMatch = q.match(/'([^']+)' in parents/);
          const parent = parentMatch ? parentMatch[1] : null;
          return { data: { files: files[parent] || [] } };
        }
        return { data: { files: [] } };
      },
      get: async () => ({ data: new ArrayBuffer(0) })
    }
  };
}

test("resolveImageRefs: plain subfolder name -> list images in shared folder", async () => {
  const drive = mockDrive({
    folders: { "root/143": { id: "folder-143", name: "143" } },
    files: { "folder-143": [
      { id: "img-1", name: "a.jpg", mimeType: "image/jpeg", webContentLink: "x" },
      { id: "img-2", name: "b.jpg", mimeType: "image/jpeg", webContentLink: "y" }
    ] }
  });
  const resolved = await resolveImageRefs({ refs: ["143"], sharedFolderId: "root", drive });
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].kind, "drive_file");
  assert.equal(resolved[0].drive_file_id, "img-1");
});

test("resolveImageRefs: plain subfolder name can be found without a parent folder", async () => {
  const drive = mockDrive({
    folders: { "143": { id: "folder-143", name: "143" } },
    files: { "folder-143": [{ id: "img-1", name: "a.jpg", mimeType: "image/jpeg" }] }
  });
  const resolved = await resolveImageRefs({ refs: ["143"], sharedFolderId: null, drive });
  assert.equal(resolved[0].drive_file_id, "img-1");
});

test("findDriveFolderByName: rejects ambiguous global folder names", async () => {
  const drive = {
    files: { list: async () => ({ data: { files: [
      { id: "folder-a", name: "143" },
      { id: "folder-b", name: "143" }
    ] } }) }
  };
  await assert.rejects(
    () => findDriveFolderByName({ name: "143", drive }),
    (error) => error.code === "DRIVE_FOLDER_AMBIGUOUS"
  );
});

test("resolveImageRefs: subfolder/filename picks specific files only", async () => {
  const drive = mockDrive({
    folders: { "root/143": { id: "folder-143", name: "143" } },
    files: { "folder-143": [
      { id: "img-1", name: "a.jpg", mimeType: "image/jpeg" },
      { id: "img-2", name: "b.jpg", mimeType: "image/jpeg" },
      { id: "img-3", name: "c.jpg", mimeType: "image/jpeg" }
    ] }
  });
  const resolved = await resolveImageRefs({
    refs: ["143/a.jpg", "143/c.jpg"],
    sharedFolderId: "root", drive
  });
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].drive_file_id, "img-1");
  assert.equal(resolved[1].drive_file_id, "img-3");
  // b.jpg must NOT be included
  assert.ok(!resolved.find((r) => r.drive_file_id === "img-2"));
});

test("resolveImageRefs: Drive folder URL -> list images", async () => {
  const drive = mockDrive({
    files: { "folderXYZ": [
      { id: "img-3", name: "c.png", mimeType: "image/png" }
    ] }
  });
  const resolved = await resolveImageRefs({
    refs: ["https://drive.google.com/drive/folders/folderXYZ"],
    sharedFolderId: null, drive
  });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].drive_file_id, "img-3");
});

test("resolveImageRefs: Drive file URL -> single drive_file", async () => {
  const resolved = await resolveImageRefs({
    refs: ["https://drive.google.com/file/d/FILE123/view"],
    sharedFolderId: null, drive: mockDrive()
  });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].kind, "drive_file");
  assert.equal(resolved[0].drive_file_id, "FILE123");
});

test("resolveImageRefs: direct image URL -> url kind", async () => {
  const resolved = await resolveImageRefs({
    refs: ["https://example.com/photo.jpg"],
    sharedFolderId: null, drive: mockDrive()
  });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].kind, "url");
  assert.equal(resolved[0].url, "https://example.com/photo.jpg");
});

test("resolveImageRefs: Facebook link with failed fetch -> facebook_link fallback", async () => {
  const resolved = await resolveImageRefs({
    refs: ["https://www.facebook.com/share/p/123/"],
    sharedFolderId: null, drive: mockDrive(),
    fetchImpl: async () => ({ ok: false, status: 403, text: async () => "" })
  });
  const fb = resolved.find((r) => r.kind === "facebook_link");
  assert.ok(fb, "should include a facebook_link fallback entry");
  assert.ok(fb.reason);
});
