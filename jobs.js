/* Shared openings — used by index.html and apply.html */
const KM_JOBS = [
  {slug:"regional-manager", title:"Regional Manager", type:"Full-time",
   desc:"Oversee daily operations across multiple KornerMart convenience stores and fuel sites in Utah. This role is accountable for store performance, cleanliness, customer service, compliance, and team development. The ideal candidate is an experienced multi-unit leader who can travel between locations, coach managers, and hold teams to a consistent standard.",
   reqs:["Multi-unit or retail leadership experience","Proven ability to develop people and drive accountability","Willingness to travel between KornerMart locations","Organized, hands-on, and results-oriented"]},
  {slug:"office-administrator", title:"Office Administrator", type:"Full-time",
   desc:"Support day-to-day business operations from our office. Responsibilities include administrative work, basic accounting, payroll support, record keeping, and assisting leadership with reporting and vendor coordination. The ideal candidate is precise, comfortable with numbers, and able to manage several priorities at once.",
   reqs:["Proficiency with Microsoft Office","Comfort with basic accounting and payroll support","Strong attention to detail and organization","Ability to multitask in a fast-paced office"]},
  {slug:"facilities-maintenance-technician", title:"Facilities Maintenance Technician", type:"Full-time",
   desc:"Maintain KornerMart stores and fuel sites so they stay safe, clean, and fully operational. Work includes general maintenance, preventative upkeep, and minor repairs, with independent troubleshooting as issues arise. The ideal candidate takes pride in quality workmanship and can manage a varied facilities workload.",
   reqs:["Strong general maintenance or handyman skills","Experience with preventative maintenance and minor repairs","Ability to diagnose and resolve issues independently","Reliable, self-directed, and committed to quality work"]},
  {slug:"cashier", title:"Cashier", type:"Part-time",
   desc:"Serve guests at the register, restock merchandise, and help keep the store clean and well-run. No prior experience is required; we provide training.",
   reqs:["Flexible availability, including weekends","Strong customer service","No experience required; training provided"]},
  {slug:"assistant-manager", title:"Assistant Manager", type:"Full-time",
   desc:"Partner with the store manager on scheduling, vendor orders, fuel deliveries, and team development. This is a hands-on leadership role with responsibility for daily store performance.",
   reqs:["At least two years of retail leadership","Inventory and vendor management experience","Open availability, including weekends"]},
];

function kmJobLabel(j){
  return j.title;
}

function kmFindJob(slug){
  if(!slug) return null;
  return KM_JOBS.find(x=>x.slug===slug)
    || KM_JOBS.find(x=>slug.startsWith(x.slug + '-'))
    || (slug==='store-associate' || slug.startsWith('store-associate-') ? KM_JOBS.find(x=>x.slug==='cashier') : null)
    || null;
}

const KM_LOCATIONS = [
  {code:"KM 01", city:"Hurricane Chevron", addr:"687 W State St, Hurricane, UT 84737", directionsUrl:"https://maps.app.goo.gl/hXrhr6Jut2UebfpE6", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 02", city:"Green Valley Sinclair", addr:"567 S Valley View Dr #15, St. George, UT 84770", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 03", city:"Sunset Chevron", addr:"929 W Sunset Blvd, St. George, UT 84770", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 04", city:"Sunset Texaco", addr:"851 W Sunset Blvd, St. George, UT 84770", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 05", city:"Riverside Texaco", addr:"1572 S Convention Center Dr, St. George, UT 84790", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 06", city:"Riverside Chevron", addr:"125 E Riverside Dr, St. George, UT 84790", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 07", city:"700 Store", addr:"795 E 700 S, St. George, UT 84770", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 08", city:"Cedar City", addr:"1355 S Main St, Cedar City, UT 84720", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 09", city:"Coral Canyon", addr:"82 N Coral Canyon Blvd, Hurricane, UT 84737", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 10", city:"Last Chance Helper", addr:"156 N Main St, Helper, UT 84526", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 11", city:"St. Blvd", addr:"994 E St. George Blvd, St. George, UT 84770", badge:"open", amenities:["Fuel","Convenience"]},
  {code:"KM 12", city:"Apple Valley", addr:"1354 State St, Apple Valley, UT 84737", badge:"open", amenities:["Fuel","Convenience"]},
];

function kmLocationLabel(l){
  return l.city + ' — ' + l.addr;
}
