var baseURI = "https://api.xero.com/api.xro/2.0/";
// Default Headers for Connection
var APIheaders = {"Xero-Tenant-Id" : "a6906be1-84ef-4f45-a1fc-9ca5b3142f7e"};

function fetchFor(endpoint) {
	let data = JSON.parse(xlc.fetch(baseURI + endpoint, APIheaders, "Xero").Result);
	return data;
}

var keyList = [];
function fetchHeaders(obj) {	
	obj.forEach(function(el){
		keyList.push(Object.keys(el))
	})
	var finalHeaders = commonKeys(...keyList);
	return finalHeaders;
}

function commonKeys() {
  var result = [];
  var lists;

  if(arguments.length === 1) {
    lists = arguments[0];
  } else {
    lists = arguments;
  }

  for(var i = 0; i < lists.length; i++) {
    var currentList = lists[i];
    for(var y = 0; y < currentList.length; y++) {
        var currentValue = currentList[y];
      if(result.indexOf(currentValue) === -1) {
        var existsInAll = true;
        for(var x = 0; x < lists.length; x++) {
          if(lists[x].indexOf(currentValue) === -1) {
            existsInAll = false;
            break;
          }
        }
        if(existsInAll) {
          result.push(currentValue);
        }
      }
    }
  }
  return result;
}


// isNull
function isNull(val){
    return val === null || val === undefined

}

function getPNL(raw, org) {
	var pnlrows = []
	const col = raw.Reports[0].Rows[0].Cells.map(c => c.Value)
	for (const rowReports of raw.Reports[0].Rows) {
		if (rowReports.RowType === 'Section') {
			for (const row of rowReports.Rows) {
				if (row.Cells[0].Attributes	!== undefined){
					// Step 1. Finding Account...
					const accCode = row.Cells[0].Attributes[0].Value;
					let acc = accounts.find(a => a.AccountID === accCode)
					for (let i = 0; i < col.length ; i++) {
						if (row.Cells[i].Value != 0) {
						pnlrows.push(
							[
								org.Name,
								acc.Code,
								acc.Name,
								acc.Class,
								acc.Type,
								acc.ReportingCode,
								acc.ReportingCodeName,
								acc.Description,
                                org.BaseCurrency,
                                row.Cells[i].Value,
							]
						)
					}
					}
				}
			}
		}
	}
	return pnlrows;
}

function getRows(obj, globalObj) {
	var tempRows = [];
	globalObj.forEach(function(el) {
		var tempParent = [];
		obj.forEach(function(o){
			tempParent.push(el[o]);
		})
		tempRows.push(tempParent);
	})
	return tempRows;
}
// Global Requests
var accounts = fetchFor("Accounts").Accounts;
var organisations = fetchFor("Organisation").Organisations[0];
var profitNloss = fetchFor("Reports/ProfitAndLoss");
xlc.setProgressMessage(`Fetching Data for ${organisations.Name}...`);

// Subset Requests (probably Headers and Rows)

// for Accounts
var accHeaders = fetchHeaders(accounts);
var accRows = getRows(accHeaders, accounts)

// for Profit & Loss
var pnlHeaders = ['Organisation Name', 'Account Code', 'Account Name', 'Class', 'Type', 'Reporting Code', 'Reporting Name', 'Description', 'Org Currency', 'Org Values'];
var pnlRows = getPNL(profitNloss, organisations);

var table = {
	Accounts : {
		headers : accHeaders,
		rows : accRows
	},
	PnL : {
		headers : pnlHeaders,
		rows : pnlRows
	}
}
table;