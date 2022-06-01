// Pulling Profit and Loss with Budget Data
/* 
	Setting variables:
		List of periods (periods)
		List of tenants (tenants)
		Base URL for Xero (baseURL)
		Get fx rate table (fxs)
*/
const TenantIds = ["a6906be1-84ef-4f45-a1fc-9ca5b3142f7e"];
const ToDate = "2022-3-31";
const numPeriods = 24;
const TarCur = "AUD";
const TCPull = "Both";
const BudgetType = "None";

const periods    = generatePeriods(ToDate, numPeriods)
const tenants    = TenantIds;
console.log(tenants.length);
const baseURL    = 'https://api.xero.com/api.xro/2.0/'
const fxs        = JSON.parse(xlc.msgs('Public', 'gVAHG1', periods.map(p => p.toDate)).Result)
if(!fxs.every(fx=>fx)) throw 'Could not find FX rates for all requested periods. Please check dates are not in the future'

// Setting Progress Bar, Maximum is set as 'Number of Periods' * 'Number of Tenants'
let progress     = 0;
xlc.setProgressMessage('Spawning web bots...')
xlc.setProgressMax(numPeriods * tenants.length)

// Temporary variables
const companies = [['*Group']]
const PLheaders = ['Organisation Name', 'Account Code', 'Account Name', 'Class', 'Type', 'Reporting Code', 'Reporting Name', 'Description', 'Tracking Category 1', 'Tracking Category 2', 'Period', 'Org Currency', 'Org Values', 'Group Currency', 'Group Values']
const BUheaders = ['Organisation Name', 'Account Code', 'Account Name', 'Class', 'Type', 'Reporting Code', 'Reporting Name', 'Description', 'Tracking Category 1', 'Tracking Category 2', 'Period', 'Org Currency', 'Org Values', 'Group Currency', 'Group Values']
let PLrows = []
let BUrows = []
let TC1rows = []
let TC2rows = []

// Iterates over each tenant
for(const tenant of tenants){

	// Xero requires the tenant-id to be in the http request headers
	// Getting Organisation and its Accounts Data
	const httpHeaders  = [{"xero-tenant-id": tenant}]
	const organisation = JSON.parse(xlc.fetch(baseURL + 'Organisation', httpHeaders, 'Xero').Result).Organisations[0]
	const accounts     = JSON.parse(xlc.fetch(baseURL + 'Accounts', httpHeaders, 'Xero').Result).Accounts
	xlc.setProgressMessage(`Bots mining data for ${organisation.Name}...`)

	// Grab Profit and Loss Data
	console.log('calling PL code for ' + organisation.Name)
	PLrows = PLrows.concat(
		GetPL(
			periods,
			httpHeaders, 
			accounts,				
			organisation,
			fxs,
			TarCur
		)
	)
	
	// Grab Budget Profit and Loss Data
	console.log('calling BU code for ' + organisation.Name)
	BUrows = BUrows.concat(
		GetBU(
			periods,
			httpHeaders, 
			accounts,				
			organisation,
			fxs,
			TarCur
		)
	)

	// Push entity to the list of companies
	companies.push([organisation.Name])
}

// Sort and Unique Tracking Categories
const TC1unirows = [['*All'], ['Unassigned']].concat(TC1rows.filter((value, index, self) => self.indexOf(value) === index).sort())
const TC2unirows = [['*All'], ['Unassigned']].concat(TC2rows.filter((value, index, self) => self.indexOf(value) === index).sort())

// Putting the data into the object 'Output'
Output    = {Time: new Date()}
Output.PL = {headers: PLheaders, rows: PLrows}
Output.BU = {headers: BUheaders, rows: BUrows}
Output.TC1 = {headers: ['Tracking Category 1'], rows: TC1unirows}
Output.TC2 = {headers: ['Tracking Category 2'], rows: TC2unirows}
Output.Org = {headers: ['Company'], rows: companies}

// Return Output
Output

/*
	FUNCTIONS
	---
	isNull
	Determining whether the input value is null/undefined or not
		Variables:
			val      : A single input value
		Return:
			A boolean  of the test
	---
	generatePeriods
	Generate an array of period for the data from End Date and number of periods specified
		Variables:
			ToDate	 : End Date for the periods (As a String)
			Periods	 : Number of periods specified
		Return:
			A list of month ending from the 'ToDate' with size of 'Periods'
	---
	GetPL
	Get profit and loss data
		Variables:
			periods  : List of periods from the 'generatePeriods'
			headers  : The http request headers
			accounts : Details of the accounts of the organisation
			org      : The object organisation which have details of the organisation
			fxs      : Table with fx data
			TarCur   : Target Currency
		Return:
			An array of array of data that represents the Profit and Loss Data
	---
	GetBU
	Get budget profit and loss data
		Variables:
			periods  : List of periods from the 'generatePeriods'
			headers  : The http request headers
			accounts : Details of the accounts of the organisation
			org      : The object organisation which have details of the organisation
			fxs      : Table with fx data
			TarCur   : Target Currency
		Return:
			An array of array of data that represents the Budget Profit and Loss Data
	---
*/

// isNull
function isNull(val){
	return val === null || val === undefined

}

// generatePeriods
function generatePeriods(ToDate, Periods){
		
	let date    = new Date(ToDate + 'Z')   // Transform the string into a Date Format
	let year    = date.getFullYear()       // Year of the date
	let month   = date.getMonth()          // Month of the date
	let periods = []                       // Array to be returned (with list of periods)
	
	// Iterates over the number of periods (Starting from 0, indicating last date)
	for(let offset = 0; offset < Periods; offset++){
	
		// Generate first and last day of the month
		const first = new Date(Date.UTC(year, month, 1))     
		const last  = new Date(Date.UTC(year, month + 1, 0))  
		
		periods.push({ 
			fromDate     : first.toISOString().slice(0, 10),
			toDate 		 : last.toISOString().slice(0, 10),
			budgetPeriod : last.toISOString().slice(0, 7)
		})
		
		month--
	}

	return periods;
}

// GetPL
function GetPL(periods, headers, accounts, org, fxs, TarCur) {
	
	// Temporary Array
	const tempRows = []

	// Get tracking categories for this tenant
	const cats = JSON.parse(xlc.fetch(baseURL + 'TrackingCategories', headers, 'Xero').Result).TrackingCategories
	const cat1 = (cats.length > 0 && (TCPull == 'Both' || TCPull == 'TC1')) ? cats[0].TrackingCategoryID : null
	const cat2 = (cats.length > 1 && (TCPull == 'Both' || TCPull == 'TC2')) ? cats[1].TrackingCategoryID : null
	
	const cat1length = cats ? 0 : cats[0].Options.length
	const cat2length = cats ? 0 : cats[1].Options.length
	const catslength = (cat1 ? cat1length : 1) * (cat2 ? cat2length : 1)
	const timeout    = 'Max Tracking Categories Combination Exceeded: Number of combinations of the tracking category to be pulled (${catslength}) are too many.'
	
	// Make the string better
	// Add an alert if the combination exceeds 100
	if (catslength > 1000) throw timeout
	
	TC1rows = cat1 ? TC1rows.concat(cats[0].Options.map(c => [c.Name])) : TC1rows
	TC2rows = cat2 ? TC2rows.concat(cats[1].Options.map(c => [c.Name])) : TC2rows
	
	// Iterates over each period
	for(const period of periods){	
			
		const cat1URL  = cat1 ? '&trackingCategoryID=' + cat1 : ''
		const cat2URL  = cat2 ? '&trackingCategoryID2=' + cat2 : ''
		const plURL    = baseURL + 'Reports/ProfitAndLoss?standardLayout=true&fromDate=' + period.fromDate + '&toDate=' + period.toDate + cat1URL + cat2URL
		const pl       = JSON.parse(xlc.fetch(plURL, headers, 'Xero').Result)
		
		// Extract tracking categories
		// Note that if both 'cat1' and 'cat2' are unassigned there is only 1 value Unassigned. It does not say 'Unassigned', 'Unassigned'
		const col      = pl.Reports[0].Rows[0].Cells.map(c => c.Value)
		const colSplit = col.map(c => c.split(',').map(v => v.trim()))
		const cat1s    = cat1URL === '' ? col.map(c => 'Unassigned') : colSplit.map(c => c[0])
		const cat2s    = cat2URL === '' ? col.map(c => 'Unassigned') : colSplit.map(c => c[c.length - 1])
		
		for(const rowReports of pl.Reports[0].Rows){
			
			if(rowReports.RowType === 'Section'){
				
				for(const row of rowReports.Rows){
					
					if(row.Cells[0].Attributes != undefined){

						/*
							There are 5 steps in getting the rows
								1. Finding the account for each row of data
								2. Get the FX rate data
								3. Change the signs for expenses as negative
								4. Determine whether the tracking categories are empty or not
								5. Pushing the row data to the temporary array 
						*/


						// Step 1: Find the account
						const accCode = row.Cells[0].Attributes[0].Value
						let acc = accounts.find(a=>a.AccountID === accCode)
						
						// special treatment of FX System account
						if(accCode === "FXGROUPID"){
							acc = {
								Code : accCode,
								Name : "Foreign Currency Gains and Losses",
								Class : "EXPENSE", // do not negate unknown accounts
								Type : 'EXPENSE',
								ReportingCode : '',
								ReportingCodeName : '',
								Description : ''
							}
						}				
						
						// handle unknown accounts
						if(isNull(acc)){
							const title = rowReports.Title
							const unknownclass = title.includes('Expense') ? 'EXPENSE' : 'REVENUE'
							acc = {

								Code              : row.Cells[0].Attributes[0].Value,
								Name              : row.Cells[0].Value,
								Class             : unknownclass, 
								Type              : '',
								ReportingCode     : '',
								ReportingCodeName : '',
								Description       : ''
							}
						}         

						// Step 2: Get the FX rate data
						const fx       = fxs.find(f => f.key === period.toDate)
						const fxRate   = fx.dat.rates[TarCur] / fx.dat.rates[org.BaseCurrency]

						// Step 3: Mark expenses as negative
						const sign         = (acc.Class ===  'REVENUE' || isNull(acc)) ? 1 : -1
						
						// Step 4 & 5: Getting the Tracking Categories and Pushing the row data
						// cats.length == 0 means that it will be a date if the for loop is done until col.length - 0 instead of col.length - 1
						for(let i = 1; i < col.length - (cat1 || cat2 ? 1 : 0); i++){
						
							const TC1      = cat1 ? cat1s[i] : "Unassigned"
							const TC2      = cat2 ? cat2s[i] : "Unassigned"

							if(row.Cells[i].Value != 0) {

								tempRows.push(
									[
										org.Name,
										acc.Code,
										acc.Name,
										acc.Class,
										acc.Type,
										acc.ReportingCode,
										acc.ReportingCodeName,
										acc.Description,
										TC1,
										TC2,
										period.toDate,
										org.BaseCurrency,
										row.Cells[i].Value * sign,
										TarCur,
										row.Cells[i].Value * sign * fxRate
									]
								)
							}
						}
					}
				}
			}
		}
	
	// Update the progress bar and pull the data
	progress++
	xlc.setProgressValue(progress)
	}

	return tempRows
}

// GetBU
function GetBU(periods, headers, accounts, org, fxs, TarCur) {

	// Temporary Array and Budget Period
	const tempRows        = []
	const budgetPeriods   = [periods[0], periods[numPeriods - 1]]

	// Checking the budget type
	if(BudgetType == 'None') {
		return tempRows
	}
	
	// Get the list of budget IDs in the organisation (for the list of periods)
	const budgetURL       = baseURL + 'Budgets?DateFrom=' + budgetPeriods[0] + '&DateTo=' + budgetPeriods[1]
	const budgets         = JSON.parse(xlc.fetch(budgetURL, headers, 'Xero').Result)
	const budgetIDs       = budgets.Budgets.filter(b => b.Type == BudgetType.toUpperCase())
	
	// Iterates over each period
	for(const budgetID of budgetIDs){	

		// Pulling the budget data for the period
		const budgetIDURL = baseURL + 'Budgets/' + budgetID.BudgetID + '?DateFrom=' + budgetPeriods[1].fromDate + '&DateTo=' + budgetPeriods[0].toDate
		const budget      = JSON.parse(xlc.fetch(budgetIDURL, headers, 'Xero').Result)
		
		if(budget.Budgets.length > 0){

			const TC1    = budget.Budgets[0].Tracking.length > 0 && (TCPull == 'Both' || TCPull == 'TC1') ? budget.Budgets[0].Tracking[0].Option : 'Unassigned'
			const TC2    = budget.Budgets[0].Tracking.length > 1 && (TCPull == 'Both' || TCPull == 'TC2') ? budget.Budgets[0].Tracking[1].Option : 'Unassigned'

			for(const budgetLine of budget.Budgets[0].BudgetLines){

				/*
					There are 4 steps in getting the rows
					 1. Finding the account for each row of data
					 2. Get the FX rate data
					 3. Change the signs for non-revenue as negative
					 4. Pushing the row data to the temporary array
				*/

				// Step 1: Find the account
				let acc   = accounts.find(a => a.AccountID == budgetLine.AccountID)
				if(isNull(acc)){
					console.log(budgetLine)
					acc = {
						Code 			  : budgetLine.AccountID,
						Name 			  : "UNKNOWN ACCOUNT",
						Class 			  : "REVENUE", 
						Type 			  : '',
						ReportingCode 	  : '',
						ReportingCodeName : '',
						Description 	  : ''
					}
				}

			
				// Step 3: Mark non-revenue item as negative
				const sign   = acc.Class == 'REVENUE' ? 1 : -1

				// Step 4: Pushing the row data
				for(const balance of budgetLine.BudgetBalances){
				
					// Step 2: Get the FX rate data
					const period = periods.find(p => p.budgetPeriod === balance.Period)
					const fx     = fxs.find(f => f.key === period.toDate)
					const fxRate = fx.dat.rates[TarCur] / fx.dat.rates[org.BaseCurrency]

					tempRows.push(
						[
							org.Name,
							acc.Code,
							acc.Name,
							acc.Class,
							acc.Type,
							acc.ReportingCode,
							acc.ReportingCodeName,
							acc.Description,
							TC1,
							TC2,
							period.toDate,
							org.BaseCurrency,
							balance.Amount * sign,
							TarCur,
							balance.Amount * sign * fxRate
						]
					)
				}
			}
		}
	}

	return tempRows
}