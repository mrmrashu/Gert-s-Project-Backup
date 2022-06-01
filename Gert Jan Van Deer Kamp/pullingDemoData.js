// Pulling Demo Data

// Setting Progress Bar, Maximum is set as '2' since we have two steps:
//  1. Calling the Demo data through the API
//  2. Putting called data into the object 'Output'

let progress  = 0;
xlc.setProgressMessage('Pulling Demo Data')
xlc.setProgressMax(2)

// Step 1: Pulling the Demo data
progress++
xlc.setProgressValue(progress);
const demo    = JSON.parse(xlc.msg('Public', 's5i2FK').Result)

progress++
xlc.setProgressValue(progress);
// Step 2: Putting the Demo data into the Output object
Output = {}
// Output.demoTB  = {headers: demo.dat.demoTB.headers, rows: demo.dat.demoTB.rows}
Output.demoPL  = {headers: demo.dat.demoPL.headers, rows: demo.dat.demoPL.rows}
Output.demoBU  = {headers: demo.dat.demoBU.headers, rows: demo.dat.demoBU.rows}
// Output.demoTBC = {headers: ['Company'], rows: demo.dat.demoOrgTB.rows}
Output.demoPLC = {headers: ['Company'], rows: demo.dat.demoPLOrg.rows}
Output.TC1     = {headers: demo.dat.demoPLTC1.headers, rows: demo.dat.demoPLTC1.rows}
Output.TC2     = {headers: demo.dat.demoPLTC2.headers, rows: demo.dat.demoPLTC2.rows}
Output.Time    = new Date()

// Return Output
Output