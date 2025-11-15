// import React, { useState } from "react";

// const mainCategories = [
//   "Christmas",
//   "Thanksgiving",
//   "Easter",
//   "Happy Birthday",
//   "Bridal",
//   "NewBorn",
// ];

// const mockSubcategories: Record<string, string[]> = {
//   Christmas: ["Family", "Romantic", "Cozy", "Minimalist"],
//   Thanksgiving: ["Family Dinner", "Friendsgiving", "Warm & Cozy"],
//   Easter: ["Kids", "Religious", "Spring Vibes"],
//   "Happy Birthday": ["Kids", "Adults", "Luxury", "Funny"],
//   Bridal: ["Save the Date", "Bridal Shower", "Bachelorette"],
//   NewBorn: ["Baby Girl", "Baby Boy", "Neutral"],
// };

// const templatesPlaceholder = new Array(5).fill(null).map((_, i) => ({
//   id: i + 1,
// }));

// export default function TheDigitalGifterDashboard() {
//   const [activeSection, setActiveSection] = useState<
//     "Categories" | "Templates" | "Orders" | "Customers" | "Statistics"
//   >("Categories");

//   const [selectedCategory, setSelectedCategory] = useState<string>(
//     mainCategories[0]
//   );

//   const subcategories = mockSubcategories[selectedCategory] || [];

//   return (
//     <div className="min-h-screen w-full bg-slate-950 text-slate-50 flex">
//       {/* Sidebar */}
//       <aside className="w-64 border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950/80 px-4 py-6 flex flex-col gap-6">
//         {/* Logo / Brand */}
//         <div className="flex items-center gap-3 px-2">
//           <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 via-pink-500 to-amber-400 flex items-center justify-center text-xl font-black tracking-tight shadow-lg shadow-red-500/40">
//             TG
//           </div>
//           <div>
//             <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
//               Admin
//             </div>
//             <div className="text-lg font-semibold">TheDigitalGifter</div>
//           </div>
//         </div>

//         {/* Main nav */}
//         <nav className="flex flex-col gap-1 text-sm">
//           {["Categories", "Templates", "Orders", "Customers", "Statistics"].map(
//             (item) => {
//               const isActive = activeSection === item;
//               return (
//                 <button
//                   key={item}
//                   onClick={() => setActiveSection(item as any)}
//                   className={`flex items-center justify-between rounded-xl px-3 py-2 transition-all text-left hover:bg-slate-800/70 hover:text-white ${
//                     isActive
//                       ? "bg-slate-100 text-slate-900 font-semibold shadow-sm shadow-red-500/30"
//                       : "text-slate-300"
//                   }`}
//                 >
//                   <span>{item}</span>
//                   {item === "Categories" && (
//                     <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
//                       Main
//                     </span>
//                   )}
//                   {item === "Templates" && (
//                     <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
//                       Items
//                     </span>
//                   )}
//                 </button>
//               );
//             }
//           )}
//         </nav>

//         {/* Helper hint */}
//         <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-xs text-slate-300">
//           <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
//             Quick tip
//           </div>
//           <p>
//             Start by creating <span className="font-semibold">Categories</span>,
//             then attach <span className="font-semibold">SubCategories</span> and
//             design your <span className="font-semibold">Templates</span>.
//           </p>
//         </div>
//       </aside>

//       {/* Main content */}
//       <main className="flex-1 px-8 py-6 flex flex-col gap-6">
//         {/* Top bar */}
//         <header className="flex items-center justify-between gap-4">
//           <div>
//             <h1 className="text-2xl font-semibold tracking-tight">
//               {activeSection === "Categories" && "Categories manager"}
//               {activeSection === "Templates" && "Templates manager"}
//               {activeSection === "Orders" && "Orders"}
//               {activeSection === "Customers" && "Customers"}
//               {activeSection === "Statistics" && "Statistics"}
//             </h1>
//             <p className="text-xs text-slate-400 mt-1">
//               Configure main categories, subcategories, and templates for
//               TheDigitalGifter.
//             </p>
//           </div>

//           <div className="flex items-center gap-3 text-xs text-slate-300">
//             <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
//               Live credits engine
//             </span>
//             <span className="rounded-full border border-slate-700 px-3 py-1">
//               Last sync: 2 min ago
//             </span>
//           </div>
//         </header>

//         {/* Active section content */}
//         {activeSection === "Categories" && (
//           <section className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)] gap-6">
//             {/* Main Categories list */}
//             <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3">
//               <div className="flex items-center justify-between mb-1">
//                 <div>
//                   <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
//                     Main Categories
//                     <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-300">
//                       Files view
//                     </span>
//                   </h2>
//                   <p className="text-xs text-slate-400 mt-1">
//                     Click a category to see and edit its SubCategories.
//                   </p>
//                 </div>
//                 <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all">
//                   + New category
//                 </button>
//               </div>

//               <div className="mt-1 space-y-1.5 text-sm">
//                 {mainCategories.map((cat) => {
//                   const isSelected = cat === selectedCategory;
//                   return (
//                     <button
//                       key={cat}
//                       onClick={() => setSelectedCategory(cat)}
//                       className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 transition-all ${
//                         isSelected
//                           ? "border-red-400/80 bg-red-500/10 text-red-100 shadow-sm shadow-red-500/40"
//                           : "border-slate-800 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
//                       }`}
//                     >
//                       <div className="flex items-center gap-3">
//                         <div className="h-8 w-8 rounded-xl border border-dashed border-slate-600/70 bg-slate-900/80 flex items-center justify-center text-[10px] uppercase tracking-[0.18em] text-slate-400">
//                           CAT
//                         </div>
//                         <div className="flex flex-col items-start">
//                           <span className="text-sm font-medium">{cat}</span>
//                           <span className="text-[11px] text-slate-400">
//                             SubCategories: {mockSubcategories[cat]?.length || 0}
//                           </span>
//                         </div>
//                       </div>
//                       <span className="text-[11px] text-slate-400">
//                         Click to edit
//                       </span>
//                     </button>
//                   );
//                 })}
//               </div>
//             </div>

//             {/* SubCategories panel */}
//             <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4">
//               <div className="flex items-center justify-between">
//                 <div>
//                   <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
//                     SubCategories
//                     <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-300">
//                       For {selectedCategory}
//                     </span>
//                   </h2>
//                   <p className="text-xs text-slate-400 mt-1">
//                     These will be shown after the user selects a main category
//                     inside the app.
//                   </p>
//                 </div>
//                 <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all">
//                   + Add subcategory
//                 </button>
//               </div>

//               <div className="flex flex-wrap gap-2 mt-1">
//                 {subcategories.length === 0 && (
//                   <span className="text-xs text-slate-500">
//                     No SubCategories yet. Add your first one.
//                   </span>
//                 )}
//                 {subcategories.map((sc) => (
//                   <button
//                     key={sc}
//                     className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-red-400/80 hover:bg-red-500/10 hover:text-red-100 transition-all flex items-center gap-2"
//                   >
//                     <span>{sc}</span>
//                     <span className="text-[10px] text-slate-500">Edit</span>
//                   </button>
//                 ))}
//               </div>

//               <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-400">
//                 <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
//                   How it works
//                 </div>
//                 <p>
//                   When you click on any{" "}
//                   <span className="font-semibold">Main Category</span>, this
//                   panel shows its{" "}
//                   <span className="font-semibold">SubCategories</span>. The same
//                   structure will be reused inside the{" "}
//                   <span className="font-semibold">Templates</span> section on
//                   the left side menu.
//                 </p>
//               </div>
//             </div>
//           </section>
//         )}

//         {activeSection === "Templates" && (
//           <section className="flex flex-col gap-4">
//             {/* Filters bar */}
//             <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3">
//               <div className="flex items-center justify-between gap-4 flex-wrap">
//                 <div>
//                   <h2 className="text-sm font-semibold tracking-tight">
//                     Templates
//                   </h2>
//                   <p className="text-xs text-slate-400 mt-1 max-w-xl">
//                     Use the buttons below to select a <b>Main Category</b> and
//                     then a <b>SubCategory</b>. All templates in that combination
//                     will be listed in the table with placeholders for upload,
//                     name, price in credits and sale percentage.
//                   </p>
//                 </div>
//                 <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all whitespace-nowrap">
//                   + New template
//                 </button>
//               </div>

//               <div className="flex flex-wrap items-center gap-3 text-xs">
//                 {/* Category selector */}
//                 <div className="flex items-center gap-2">
//                   <span className="text-slate-400">Category</span>
//                   <button className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 hover:border-red-400/70 hover:bg-red-500/10 hover:text-red-100 transition-all">
//                     <span>{selectedCategory}</span>
//                     <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
//                       Change
//                     </span>
//                   </button>
//                 </div>

//                 {/* SubCategories selector */}
//                 <div className="flex items-center gap-2">
//                   <span className="text-slate-400">Sub Categories</span>
//                   <div className="flex flex-wrap gap-2">
//                     {subcategories.length === 0 && (
//                       <span className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-500">
//                         No SubCategories yet
//                       </span>
//                     )}
//                     {subcategories.map((sc) => (
//                       <button
//                         key={sc}
//                         className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:border-red-400/80 hover:bg-red-500/10 hover:text-red-100 transition-all"
//                       >
//                         {sc}
//                       </button>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Templates table */}
//             <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
//               <div className="flex items-center justify-between mb-3">
//                 <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
//                   Templates listing
//                 </h3>
//                 <span className="text-[11px] text-slate-500">
//                   Columns: upload item • template name • price in credits • sale
//                   %
//                 </span>
//               </div>

//               <div className="w-full overflow-x-auto text-xs">
//                 <table className="min-w-full border-separate border-spacing-y-2">
//                   <thead>
//                     <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
//                       <th className="text-left font-medium px-2 py-1">
//                         Upload item
//                       </th>
//                       <th className="text-left font-medium px-2 py-1">
//                         Name of template
//                       </th>
//                       <th className="text-left font-medium px-2 py-1">
//                         Price in credits
//                       </th>
//                       <th className="text-left font-medium px-2 py-1">
//                         % sale
//                       </th>
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {templatesPlaceholder.map((row) => (
//                       <tr key={row.id}>
//                         {/* Upload placeholder */}
//                         <td className="px-2 py-1 align-top">
//                           <div className="h-12 w-20 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 flex flex-col items-center justify-center gap-1">
//                             <span className="text-[10px] text-slate-400">
//                               Upload
//                             </span>
//                             <span className="text-[9px] text-slate-500">
//                               Preview image
//                             </span>
//                           </div>
//                         </td>

//                         {/* Name placeholder */}
//                         <td className="px-2 py-1 align-top">
//                           <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 flex flex-col gap-1">
//                             <div className="h-3 rounded-full bg-slate-700/60 w-32" />
//                             <div className="h-2.5 rounded-full bg-slate-800/70 w-48" />
//                           </div>
//                         </td>

//                         {/* Price in credits placeholder */}
//                         <td className="px-2 py-1 align-top">
//                           <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
//                             <div className="h-5 w-5 rounded-full border border-amber-400/50 bg-amber-500/15 flex items-center justify-center text-[9px] font-bold">
//                               💰
//                             </div>
//                             <div className="flex flex-col">
//                               <span className="h-2.5 rounded-full bg-slate-700/70 w-10" />
//                               <span className="text-[9px] text-slate-500 mt-0.5">
//                                 credits per image
//                               </span>
//                             </div>
//                           </div>
//                         </td>

//                         {/* % sale placeholder */}
//                         <td className="px-2 py-1 align-top">
//                           <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5">
//                             <span className="h-2.5 rounded-full bg-emerald-400/70 w-10" />
//                             <span className="text-[9px] text-emerald-200">
//                               % discount / sale
//                             </span>
//                           </div>
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>

//                 {/* Legend */}
//                 <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
//                   <span className="rounded-full border border-dashed border-slate-700 bg-slate-900 px-2.5 py-1">
//                     1. Placeholder for upload item
//                   </span>
//                   <span className="rounded-full border border-dashed border-slate-700 bg-slate-900 px-2.5 py-1">
//                     2. Placeholder for name of template
//                   </span>
//                   <span className="rounded-full border border-dashed border-slate-700 bg-slate-900 px-2.5 py-1">
//                     3. Placeholder for price in credits
//                   </span>
//                   <span className="rounded-full border border-dashed border-slate-700 bg-slate-900 px-2.5 py-1">
//                     4. Placeholder for % sale percentage
//                   </span>
//                 </div>
//               </div>
//             </div>
//           </section>
//         )}

//         {activeSection !== "Categories" && activeSection !== "Templates" && (
//           <section className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-300">
//             <p>
//               This area is reserved for the{" "}
//               <span className="font-semibold">{activeSection}</span> panel. For
//               now, the focus is on building: <b>Categories</b>,{" "}
//               <b>SubCategories</b>, and <b>Templates</b>.
//             </p>
//           </section>
//         )}
//       </main>
//     </div>
//   );
// }

import React, { useState } from "react";

const mainCategories = [
  "Christmas",
  "Thanksgiving",
  "Easter",
  "Happy Birthday",
  "Bridal",
  "NewBorn",
];

const mockSubcategories = {
  Christmas: ["Family", "Romantic", "Cozy", "Minimalist"],
  Thanksgiving: ["Family Dinner", "Friendsgiving", "Warm & Cozy"],
  Easter: ["Kids", "Religious", "Spring Vibes"],
  "Happy Birthday": ["Kids", "Adults", "Luxury", "Funny"],
  Bridal: ["Save the Date", "Bridal Shower", "Bachelorette"],
  NewBorn: ["Baby Girl", "Baby Boy", "Neutral"],
};

const templatesPlaceholder = new Array(5)
  .fill(null)
  .map((_, i) => ({ id: i + 1 }));

const creditPackagesPlaceholder = [
  { id: 1, name: "Starter" },
  { id: 2, name: "Standard" },
  { id: 3, name: "Pro" },
  { id: 4, name: "Ultra" },
];

const generatedOrdersPlaceholder = [
  {
    id: 1,
    templateName: "Cozy Christmas Couple Portrait",
    creditsUsed: 12,
    avgTime: "18s",
    timestamp: "2025-11-14 10:32",
  },
  {
    id: 2,
    templateName: "Family Christmas Card - Classic",
    creditsUsed: 10,
    avgTime: "22s",
    timestamp: "2025-11-14 10:21",
  },
  {
    id: 3,
    templateName: "Romantic Snowy Night Reel",
    creditsUsed: 18,
    avgTime: "35s",
    timestamp: "2025-11-14 09:58",
  },
  {
    id: 4,
    templateName: "Business Christmas Post - Minimalist",
    creditsUsed: 8,
    avgTime: "15s",
    timestamp: "2025-11-14 09:44",
  },
];

const creditOrdersPlaceholder = [
  {
    id: 1,
    packageName: "Starter",
    creditsBought: 25,
    paid: "€4.98",
    timestamp: "2025-11-14 09:30",
  },
  {
    id: 2,
    packageName: "Standard",
    creditsBought: 80,
    paid: "€14.90",
    timestamp: "2025-11-13 18:02",
  },
  {
    id: 3,
    packageName: "Pro",
    creditsBought: 200,
    paid: "€32.00",
    timestamp: "2025-11-13 12:17",
  },
];

const customersPlaceholder = [
  {
    id: 1,
    email: "andrei.popescu@example.com",
    region: "RO - Bucharest",
    ordersCount: 7,
    createdAt: "2025-11-01 14:22",
  },
  {
    id: 2,
    email: "sofia.dubai@example.com",
    region: "AE - Dubai",
    ordersCount: 12,
    createdAt: "2025-10-28 09:05",
  },
  {
    id: 3,
    email: "marco.italia@example.com",
    region: "IT - Milano",
    ordersCount: 3,
    createdAt: "2025-11-10 19:47",
  },
];

const statsRanges = ["Today", "This week", "This month"];

export default function TheDigitalGifterDashboard() {
  const [activeSection, setActiveSection] = useState("Categories");
  const [selectedCategory, setSelectedCategory] = useState(mainCategories[0]);
  const [ordersTab, setOrdersTab] = useState("Generated");
  const [statsRange, setStatsRange] = useState("Today");

  const subcategories = mockSubcategories[selectedCategory] || [];

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-50 flex">
      <aside className="w-64 border-r border-slate-800 bg-slate-950 px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 via-pink-500 to-amber-400 flex items-center justify-center text-xl font-black tracking-tight shadow-lg shadow-red-500/40">
            TG
          </div>
          <div>
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Admin
            </div>
            <div className="text-lg font-semibold">TheDigitalGifter</div>
          </div>
        </div>

        <nav className="flex flex-col gap-1 text-sm">
          {[
            "Categories",
            "Templates",
            "Credits",
            "Orders",
            "Customers",
            "Statistics",
          ].map((item) => {
            const isActive = activeSection === item;
            return (
              <button
                key={item}
                onClick={() => setActiveSection(item)}
                className={`flex items-center justify-between rounded-xl px-3 py-2 transition-all text-left hover:bg-slate-800/70 hover:text-white ${
                  isActive
                    ? "bg-slate-100 text-slate-900 font-semibold shadow-sm shadow-red-500/30"
                    : "text-slate-300"
                }`}
              >
                <span>{item}</span>
                {item === "Categories" && (
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Main
                  </span>
                )}
                {item === "Templates" && (
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Items
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-900/60 px-3 py-3 text-xs text-slate-300">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mb-1">
            Quick tip
          </div>
          <p>
            Start with <span className="font-semibold">Categories</span>,
            connect <span className="font-semibold">SubCategories</span>, then
            add <span className="font-semibold">Templates</span> and pricing.
          </p>
        </div>
      </aside>

      <main className="flex-1 px-8 py-6 flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {activeSection === "Categories" && "Categories manager"}
              {activeSection === "Templates" && "Templates manager"}
              {activeSection === "Credits" && "Credits packages"}
              {activeSection === "Orders" && "Orders"}
              {activeSection === "Customers" && "Customers"}
              {activeSection === "Statistics" && "Statistics"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Configure categories, templates, credits, orders, customers and
              statistics for TheDigitalGifter.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
              Live credits engine
            </span>
            <span className="rounded-full border border-slate-700 px-3 py-1">
              Last sync: 2 min ago
            </span>
          </div>
        </header>

        {activeSection === "Categories" && (
          <section className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.6fr)] gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    Main Categories
                    <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-300">
                      Files view
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Click a category to see and edit its SubCategories.
                  </p>
                </div>
                <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all">
                  + New category
                </button>
              </div>

              <div className="mt-1 space-y-1.5 text-sm">
                {mainCategories.map((cat) => {
                  const isSelected = cat === selectedCategory;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 transition-all ${
                        isSelected
                          ? "border-red-400/80 bg-red-500/10 text-red-100 shadow-sm shadow-red-500/40"
                          : "border-slate-800 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl border border-dashed border-slate-600/70 bg-slate-900/80 flex items-center justify-center text-[10px] uppercase tracking-[0.18em] text-slate-400">
                          CAT
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium">{cat}</span>
                          <span className="text-[11px] text-slate-400">
                            SubCategories: {mockSubcategories[cat]?.length || 0}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Click to edit
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    SubCategories
                    <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-300">
                      For {selectedCategory}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    These will be shown after the user selects a main category
                    inside the app.
                  </p>
                </div>
                <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all">
                  + Add subcategory
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-1">
                {subcategories.length === 0 && (
                  <span className="text-xs text-slate-500">
                    No SubCategories yet. Add your first one.
                  </span>
                )}
                {subcategories.map((sc) => (
                  <button
                    key={sc}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-red-400/80 hover:bg-red-500/10 hover:text-red-100 transition-all flex items-center gap-2"
                  >
                    <span>{sc}</span>
                    <span className="text-[10px] text-slate-500">Edit</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-400">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  How it works
                </div>
                <p>
                  When you click a{" "}
                  <span className="font-semibold">Main Category</span>, this
                  panel shows its{" "}
                  <span className="font-semibold">SubCategories</span>. The same
                  structure is reused inside{" "}
                  <span className="font-semibold">Templates</span>.
                </p>
              </div>
            </div>
          </section>
        )}

        {activeSection === "Templates" && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Templates
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Select a <b>Main Category</b> and <b>SubCategory</b>.
                    Templates will be listed below with placeholders.
                  </p>
                </div>
                <button className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800 transition-all whitespace-nowrap">
                  + New template
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Category</span>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 hover:border-red-400/70 hover:bg-red-500/10 hover:text-red-100 transition-all">
                    <span>{selectedCategory}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      Change
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Sub Categories</span>
                  <div className="flex flex-wrap gap-2">
                    {subcategories.length === 0 && (
                      <span className="rounded-xl border border-dashed border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-500">
                        No SubCategories yet
                      </span>
                    )}
                    {subcategories.map((sc) => (
                      <button
                        key={sc}
                        className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:border-red-400/80 hover:bg-red-500/10 hover:text-red-100 transition-all"
                      >
                        {sc}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Templates listing
                </h3>
                <span className="text-[11px] text-slate-500">
                  Upload item • Name • Price in credits • % sale
                </span>
              </div>

              <div className="w-full overflow-x-auto text-xs">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <th className="text-left font-medium px-2 py-1">
                        Upload item
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Name of template
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Price in credits
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        % sale
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {templatesPlaceholder.map((row) => (
                      <tr key={row.id}>
                        <td className="px-2 py-1 align-top">
                          <div className="h-12 w-20 rounded-xl border border-dashed border-slate-700 bg-slate-900/80 flex flex-col items-center justify-center gap-1">
                            <span className="text-[10px] text-slate-400">
                              Upload
                            </span>
                            <span className="text-[9px] text-slate-500">
                              Preview image
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 flex flex-col gap-1">
                            <div className="h-3 rounded-full bg-slate-700/60 w-32" />
                            <div className="h-2.5 rounded-full bg-slate-800/70 w-48" />
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                            <div className="h-5 w-5 rounded-full border border-amber-400/50 bg-amber-500/15 flex items-center justify-center text-[9px] font-bold">
                              💰
                            </div>
                            <div className="flex flex-col">
                              <span className="h-2.5 rounded-full bg-slate-700/70 w-10" />
                              <span className="text-[9px] text-slate-500 mt-0.5">
                                credits per image
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5">
                            <span className="h-2.5 rounded-full bg-emerald-400/70 w-10" />
                            <span className="text-[9px] text-emerald-200">
                              % discount / sale
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "Credits" && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  Credits packages
                  <span className="rounded-full bg-slate-800 px-2 py-[2px] text-[10px] text-slate-300">
                    Starter + 3 bundles
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Define the credit bundles your customers can purchase. Each
                  row is a placeholder for package, EUR, credits and discount.
                </p>
              </div>
              <button className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400 transition-all whitespace-nowrap">
                + Add new package
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Credits listing
                </h3>
                <span className="text-[11px] text-slate-500">
                  Package • Price EUR • Price credits • Discount %
                </span>
              </div>

              <div className="w-full overflow-x-auto text-xs">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <th className="text-left font-medium px-2 py-1">
                        Package
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Price EUR
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Price credits
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Discount %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditPackagesPlaceholder.map((pkg) => (
                      <tr key={pkg.id}>
                        <td className="px-2 py-1 align-top">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 flex flex-col gap-1">
                            <div className="h-3 rounded-full bg-slate-700/70 w-32" />
                            <div className="text-[10px] text-slate-500">
                              {pkg.name} (placeholder)
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 flex items-center gap-2">
                            <span className="text-[11px] text-slate-400 mr-1">
                              €
                            </span>
                            <div className="h-3 rounded-full bg-slate-700/70 w-20" />
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5">
                            <div className="h-5 w-5 rounded-full border border-amber-400/50 bg-amber-500/15 flex items-center justify-center text-[9px] font-bold">
                              💰
                            </div>
                            <div className="flex flex-col">
                              <span className="h-2.5 rounded-full bg-slate-700/70 w-10" />
                              <span className="text-[9px] text-slate-500 mt-0.5">
                                credits total
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5">
                            <span className="h-2.5 rounded-full bg-emerald-400/70 w-10" />
                            <span className="text-[9px] text-emerald-200">
                              % discount
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "Orders" && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Orders
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    View all activity separated by generated templates and
                    credits purchases.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 p-1 border border-slate-800">
                  <button
                    onClick={() => setOrdersTab("Generated")}
                    className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                      ordersTab === "Generated"
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Generated
                  </button>
                  <button
                    onClick={() => setOrdersTab("Credits")}
                    className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                      ordersTab === "Credits"
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Credits
                  </button>
                </div>
              </div>
            </div>

            {ordersTab === "Generated" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Generated templates
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Name • Credits used • Avg time • Timestamp
                  </span>
                </div>
                <div className="w-full overflow-x-auto text-xs">
                  <table className="min-w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        <th className="text-left font-medium px-2 py-1">
                          Name of template generated
                        </th>
                        <th className="text-left font-medium px-2 py-1">
                          Credits used
                        </th>
                        <th className="text-left font-medium px-2 py-1">
                          Avg time to generate
                        </th>
                        <th className="text-left font-medium px-2 py-1">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedOrdersPlaceholder.map((order) => (
                        <tr key={order.id}>
                          <td className="px-2 py-1 align-top">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
                              <div className="text-[11px] font-medium text-slate-100">
                                {order.templateName}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Order ID #{order.id}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px]">
                              <span className="mr-1">💰</span>
                              {order.creditsUsed} credits
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px]">
                              {order.avgTime}
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="text-[11px] text-slate-300">
                              {order.timestamp}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ordersTab === "Credits" && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Credits purchases
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Package • Credits bought • Paid • Timestamp
                  </span>
                </div>
                <div className="w-full overflow-x-auto text-xs">
                  <table className="min-w-full border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                        <th className="text-left font-medium px-2 py-1">
                          Package name
                        </th>
                        <th className="text-left font-medium px-2 py-1">
                          Credits bought
                        </th>
                        <th className="text-left font-medium px-2 py-1">
                          Paid (amount)
                        </th>
                        <th className="text-left font-medium px-2 py-1">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditOrdersPlaceholder.map((order) => (
                        <tr key={order.id}>
                          <td className="px-2 py-1 align-top">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-100">
                              {order.packageName}
                            </div>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px]">
                              {order.creditsBought} credits
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-100">
                              {order.paid}
                            </span>
                          </td>
                          <td className="px-2 py-1 align-top">
                            <span className="text-[11px] text-slate-300">
                              {order.timestamp}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {activeSection === "Customers" && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  Customers
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Email, region, orders (with link), time of account creation.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Customers listing
                </h3>
                <span className="text-[11px] text-slate-500">
                  Email • Region • Orders • Account created at
                </span>
              </div>

              <div className="w-full overflow-x-auto text-xs">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      <th className="text-left font-medium px-2 py-1">Email</th>
                      <th className="text-left font-medium px-2 py-1">
                        Region
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Orders
                      </th>
                      <th className="text-left font-medium px-2 py-1">
                        Time of account creation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersPlaceholder.map((customer) => (
                      <tr key={customer.id}>
                        <td className="px-2 py-1 align-top">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] text-slate-100">
                            {customer.email}
                          </div>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px]">
                            {customer.region}
                          </span>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <a
                            href="#orders"
                            className="text-[11px] text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
                          >
                            {customer.ordersCount} orders
                          </a>
                        </td>
                        <td className="px-2 py-1 align-top">
                          <span className="text-[11px] text-slate-300">
                            {customer.createdAt}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeSection === "Statistics" && (
          <section className="flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    Statistics
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Select a range and see: new accounts, generations, credits
                    bought, total revenue.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 text-xs">
                  <div className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 p-1 border border-slate-800">
                    {statsRanges.map((range) => (
                      <button
                        key={range}
                        onClick={() => setStatsRange(range)}
                        className={`px-3 py-1.5 rounded-full transition-all ${
                          statsRange === range
                            ? "bg-slate-100 text-slate-900 font-semibold"
                            : "text-slate-300 hover:text-white"
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Calendar / date range picker placeholder
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  New accounts
                </span>
                <span className="text-2xl font-semibold">24</span>
                <span className="text-[11px] text-emerald-300">
                  +8 vs yesterday
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Generations
                </span>
                <span className="text-2xl font-semibold">132</span>
                <span className="text-[11px] text-emerald-300">
                  +21 vs yesterday
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Credits bought
                </span>
                <span className="text-2xl font-semibold">1,850</span>
                <span className="text-[11px] text-emerald-300">
                  +320 vs yesterday
                </span>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-2">
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Total revenue
                </span>
                <span className="text-2xl font-semibold">€492</span>
                <span className="text-[11px] text-emerald-300">
                  +€120 vs yesterday
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
