export function ActivityFeed() {
  return (
    <div className="rounded-xl border border-[#E8E0D8] bg-white p-4">
      <h2 className="font-['Playfair_Display'] text-base font-semibold text-[#0A1F4D] mb-3">
        Recent Activity
      </h2>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[#F0F4FF] flex items-center justify-center mb-3">
          <span className="text-2xl">🔔</span>
        </div>
        <p className="text-sm font-medium text-[#0A1F4D]">No activity yet</p>
        <p className="text-xs text-[#6B6B76] mt-1">
          Match requests and updates will appear here
        </p>
      </div>
    </div>
  );
}
