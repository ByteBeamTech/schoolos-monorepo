'use client';
import { useState } from 'react';
import { Search, MapPin, Filter, ChevronDown, ChevronRight, ToggleRight } from 'lucide-react';

export default function SchoolsMasterPage() {
  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">School Directory</h1>
        <p className="text-gray-500">Manage tenants, branches, and features globally.</p>
      </header>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm mb-6 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-gray-400" size={18} />
          <input type="text" placeholder="Search School or Group..." className="w-full pl-10 pr-4 py-2 border rounded-lg" />
        </div>
        <select className="border p-2 rounded-lg text-sm"><option>All States</option></select>
        <input type="text" placeholder="Pincode" className="border p-2 rounded-lg text-sm w-32" />
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Apply Filters</button>
      </div>

      {/* Schools Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">School / Branch Group</th>
              <th className="p-4">Location</th>
              <th className="p-4 text-center">Referral</th>
              <th className="p-4">Plan</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b hover:bg-gray-50">
              <td className="p-4 font-bold flex items-center gap-2">
                <ChevronRight size={18} /> Doon Global School (HQ)
              </td>
              <td className="p-4 text-sm text-gray-600">Lucknow, UP</td>
              <td className="p-4 text-center"><ToggleRight className="text-blue-600 cursor-pointer" size={28} /></td>
              <td className="p-4"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs font-bold">ULTRA</span></td>
              <td className="p-4 text-blue-600 cursor-pointer font-medium hover:underline">View Details</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
