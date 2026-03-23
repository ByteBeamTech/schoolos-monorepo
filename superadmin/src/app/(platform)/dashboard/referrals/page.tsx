import React from 'react';

export default function ReferralsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Referral Command Center</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referrer School</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New School</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {/* Data mapped from API */}
            <tr>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Delhi Public School</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">St. Mary Academy</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Verified</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹2,000</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
