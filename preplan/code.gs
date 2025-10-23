/***** SETTINGS *****/
const SPREADSHEET_ID = '1B1JbGtXAl-ymNQ-vb4UBRwZZ36byfu3fva0XpstidNA';
const SHEET_NAME     = 'Form Responses';
// Comment out the next line to use numeric row numbers instead.
const KEY_COL_HEADER = 'Stable ID';

/** Optional default Drive folder IDs per photo column */
const PHOTO_FIELD_FOLDERS = {
  'Photo':                    '1AZWEVmdqmuUZceORmi24ULowcuPURGvWwIB4rJKklGkaIx8M_5jl789mHLLwQoCvtLOWrQHj',
  'Roof Photo':               '1tB3H1OAgBW5cmMugNFKbJPpK80FaDa7ZQ36xCSamawFFefRMsZ1cLlPRSmnll6BSLu62c5S0',
  'Alarm Photo':              '1UWb5MlIFy6QqgKn5ST3F5XW9hgl_MtzE4aJzomb7l0iS3c9jbA_fg4_kq7KZ_Pt7GrLLnp3c',
  'Elevator Shutoff Photo':   '1H_VrGy1fkWPK38BJSCgjqNrP3W3G0jcLLLTDfGpJno2KihA3Lzb8G6fXqjfgwvcAmK8gLoM-',
  'Gas Shutoff Photo':        '1bgG9RNthY7FsAhGAddu3OKCRL5NU4-HS2iS_n6YOPoX-X4Pdr-J9RFYQWAiCPbFgvsBuyQMG',
  'Electrical Shutoff Photo': '1dcc6X2iAoykCd5zLztJsW6PmYUn18W6Pu6g83ATyWD7ej7oSTg-Wi2-HJEluwwEqaitz8pSg',
  'Water Shutoff Photo':      '1CyzbXB5R3JnMgbqumS0VsAo0FwlHrRdEnUbIj7_Je_4ROkVsJiGu8WhtagzZHXulW8QQ1pci',
  'Sprinkler Shutoff Photo':  '1E54lFORNMMzNDzx0S2Y-4CdCCCWtFb_DIZlh31c5D0DeKWITKsjvkx37zVt-Ta09aWIVAMq0',
  'Fire Pump Photo':          '1LZldDUuXr1qv3LwNqwiDKb9dv55H5PVWi7gCnXUxRRp6T8QStSTA8xO_bZbIc72rTRd8Pi8V',
  'Tanks Photo':              '1VdqT_6_7uUYtSUwyc0ruXV2NrM6IYivI5Jf9LoL5vX1IlCZPUXxEGVrHtJwWlT4ZDBqdyGLV',
  'Combustibles Photo':       '1Pf6Vk6MwYZnS5UE3hRfCQsZijNHaf6DfZorFxKWusxKHE39zhX248XUqepQXHnRoYKusYDP-',
  'Gas Photo':                '1EB4RuHvOfRYbJu644-AuV9DvZOjQ6FY4JhVg4KVmqWo5iQVA-nauAp_7-LCN1kBcG8j-AvHC',
  'Hazmat Photo':             '1ms9ufkhmAcs9Dfh7uoaUo74Adkox-ZNesVTLMbwS8Wku-K2hyUOueHy7vvgG_I-7mSP-lNNx'
};


/***** WEB ENTRY POINTS *****/
function doGet(e) {
  const p  = (e && e.parameter) || {};
  const fn = p.fn || '';

  if (p.ui === 'edit') return renderEditorUI_(p.key || '');

  if (fn === 'meta')  return json_(getMeta_());
  if (fn === 'row')   return json_(getRow_(p));
  if (fn === 'list')  return json_(getList_());
  if (fn === 'debug') return json_(debugResolve_(p.key));

  return json_({ ok:true, message:'OK' });
}

function doPost(e) {
  try {
    const contentType = (e && e.postData && typeof e.postData.type === 'string') ? e.postData.type : '';

    if (contentType && contentType.indexOf('application/json') === 0) {
      const body = e.postData.contents ? JSON.parse(e.postData.contents) : {};
      if (body.fn === 'update') return json_(updateRow_(body.key, body.values));
      return json_({ ok:false, error:'Unknown fn' }, 400);
    }

    const p  = (e && e.parameter) || {};
    const fn = p.fn || '';
    if (fn === 'uploadPhoto')    return json_({ ok:false, error:'Use apiUploadBase64' }, 400);
    if (fn === 'assignExisting') return json_(_handleAssignExisting_(e)); // not used in UI now
    return json_({ ok:false, error:'Unknown fn' }, 400);
  } catch (err) {
    return json_({ ok:false, error:String(err) }, 500);
  }
}


/***** EDITOR UI (HtmlService) *****/

# editor UI kept in separate edit.html in static site; server-side UI available via renderEditorUI_ as in user's version
