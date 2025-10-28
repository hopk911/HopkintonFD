/***** Drive Image Proxy - Blob return (recommended) *****
 * Deploy as Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 * URL: .../exec?id=<DRIVE_FILE_ID>&w=300
 *****/

function doGet(e){
  try{
    var p = (e && e.parameter) || {};
    var fn = p.fn || '';
    if (fn === 'save' && p.cb) {
      var body = _parseBody(e);
      var resp = _save_(body); // returns TextOutput(JSON)
      var text = String(p.cb) + '(' + resp.getContent() + ')';
      return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return _json({ ok:false, error:'Missing or unsupported params' });
  }catch(err){
    return _json({ ok:false, error:String(err) });
  }
}
;
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


/***** Minimal JSON helpers & save handler *****/
function _json(obj){ return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }


function _parseBody(e){
  try{
    if (e && e.postData) {
      var ct = (e.postData.type || e.postData.contentType || '').toLowerCase();
      var raw = e.postData.contents || '';
      if (/application\/json/.test(ct) && raw) return JSON.parse(raw);
    }
    if (e && e.parameter && e.parameter.payload) {
      return JSON.parse(e.parameter.payload);
    }
  }catch(err){}
  return {};
}

    if (e && e.parameter && e.parameter.payload) {
      return JSON.parse(e.parameter.payload);
    }
  }catch(err){}
  return {};
}
catch(err){ return {}; } }
function _headerRow_(sheet){ return sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]; }
function _colIndex_(headers, name){ name=String(name||'').trim().toLowerCase(); for (var i=0;i<headers.length;i++){ if (String(headers[i]||'').trim().toLowerCase()===name) return i; } return -1; }
function _findRow_(sheet, keyField, keyVal){
  var data = sheet.getDataRange().getValues(); var headers=data[0]; var col=_colIndex_(headers,keyField); if (col<0) return -1;
  for (var r=1;r<data.length;r++){ if (String(data[r][col])===String(keyVal)) return r+1; } return -1;
}

function doPost(e){
  var body=_parseBody(e);
  var fn=(body && body.fn) || (e && e.parameter && e.parameter.fn) || '';
  if (fn==='save') return _save_(body);
  return _json({ ok:false, error:'Unknown fn' });
}
; var fn=(body.fn)||(e.parameter&&e.parameter.fn)||'';
  if (fn==='save') return _save_(body); return _json({ ok:false, error:'Unknown fn'});
}

function _save_(body){
  try{
    var ss = SpreadsheetApp.openById(typeof SPREADSHEET_ID!=='undefined'?SPREADSHEET_ID:SpreadsheetApp.getActive().getId());
    var sh = ss.getSheetByName(typeof SHEET_NAME!=='undefined'?SHEET_NAME:'Form Responses');
    if (!sh) return _json({ ok:false, error:'Sheet not found' });
    var keyField = (body && body.keyField) || (typeof KEY_COL_HEADER!=='undefined'?KEY_COL_HEADER:'Stable ID');
    var key = (body && body.key) || '';
    var rowObj = (body && body.row) || {};
    if (!key) return _json({ ok:false, error:'Missing key' });
    var data = sh.getDataRange().getValues();
    var headers = data[0] || [];
    function colIndex(name){ name=String(name||'').trim().toLowerCase(); for (var i=0;i<headers.length;i++){ if (String(headers[i]||'').trim().toLowerCase()===name) return i; } return -1; }
    var kCol = colIndex(keyField); if (kCol < 0) return _json({ ok:false, error:'Key field not found: ' + keyField });
    var rowIndex = -1; for (var r=1;r<data.length;r++){ if (String(data[r][kCol])===String(key)) { rowIndex=r+1; break; } }
    if (rowIndex < 2) return _json({ ok:false, error:'Key not found: ' + key });
    var rowVals = sh.getRange(rowIndex,1,1,headers.length).getValues()[0];
    for (var c=0;c<headers.length;c++){ var h=String(headers[c]||''); if (h && rowObj.hasOwnProperty(h)) rowVals[c]=rowObj[h]; }
    sh.getRange(rowIndex,1,1,headers.length).setValues([rowVals]);
    return _json({ ok:true, updatedRow: rowIndex });
  }catch(err){ return _json({ ok:false, error:String(err) }); }
}
);
    var keyField=(body.keyField)||(typeof KEY_COL_HEADER!=='undefined'?KEY_COL_HEADER:'Stable ID');
    var key=String(body.key||''); if (!key) return _json({ ok:false, error:'Missing key'});
    var rowIndex=_findRow_(sh,keyField,key); if (rowIndex<2) return _json({ ok:false, error:'Key not found'});
    var headers=_headerRow_(sh); var rowVals=sh.getRange(rowIndex,1,1,headers.length).getValues()[0];
    var rowObj=body.row||{};
    for (var c=0;c<headers.length;c++){ var h=String(headers[c]||''); if (h && rowObj.hasOwnProperty(h)) rowVals[c]=rowObj[h]; }
    sh.getRange(rowIndex,1,1,headers.length).setValues([rowVals]);
    return _json({ ok:true, updatedRow: rowIndex });
  }catch(err){ return _json({ ok:false, error:String(err) }); }
}
