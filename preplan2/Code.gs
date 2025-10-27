/***** Drive Image Proxy - Blob return (recommended) *****
 * Deploy as Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 * URL: .../exec?id=<DRIVE_FILE_ID>&w=300
 *****/
function doGet(e) {
  var p = (e && e.parameter) || {};
  var id = p.id || p.fileId || '';
  var w  = Math.max(80, Math.min(2000, Number(p.w) || 800));

  if (!id) {
    if (String(p && p.fn) === 'img' && p.u) {
      var r = UrlFetchApp.fetch(p.u, { muteHttpExceptions: true, followRedirects: true });
      var b = r.getBlob();
      return b.setContentType(b.getContentType() || 'image/jpeg');
    }
    return Utilities.newBlob('missing id', 'text/plain');
  }

  try {
    var file = DriveApp.getFileById(id);
    var blob = file.getBlob();
    var ct   = blob.getContentType() || 'image/jpeg';

    // If not an image (e.g., Docs/Slides), fetch Drive thumbnail
    if (!/^image\//i.test(ct)) {
      var tUrl = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + w;
      var tRes = UrlFetchApp.fetch(tUrl, { muteHttpExceptions: true, followRedirects: true });
      if (tRes.getResponseCode() >= 200 && tRes.getResponseCode() < 300) {
        var tb = tRes.getBlob();
        return tb.setContentType('image/jpeg');
      }
      // Try lh3 as a last resort
      var gUrl = 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id) + '=w' + w;
      var gRes = UrlFetchApp.fetch(gUrl, { muteHttpExceptions: true, followRedirects: true });
      if (gRes.getResponseCode() >= 200 && gRes.getResponseCode() < 300) {
        var gb = gRes.getBlob();
        return gb.setContentType('image/jpeg');
      }
      return Utilities.newBlob('thumbnail not available', 'text/plain');
    }

    // If it is an image, return the original blob
    return blob.setContentType(ct);

  } catch (err) {
    return Utilities.newBlob('error: ' + err, 'text/plain');
  }
}
