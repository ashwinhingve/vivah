import Link from 'next/link';

const ACTIONS = [
  { href: '/discover',  label: 'Discover Matches',  desc: 'Browse compatible profiles'  },
  { href: '/requests',  label: 'Match Requests',    desc: 'Review incoming requests'    },
  { href: '/bookings',  label: 'My Bookings',       desc: 'Wedding vendor bookings'     },
  { href: '/profile/create', label: 'Edit Profile', desc: 'Update your profile'         },
] as const;

export function QuickActions() {
  return (
    <div className="rounded-xl border border-[#E8E0D8] bg-white p-4">
      <h2 className="font-['Playfair_Display'] text-base font-semibold text-[#0A1F4D] mb-3">
        Quick Actions
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-[#E8E0D8] p-3 hover:border-[#1848C8] hover:bg-[#F0F4FF] transition-colors group min-h-[44px] flex flex-col justify-center"
          >
            <p className="text-sm font-semibold text-[#0A1F4D] group-hover:text-[#1848C8]">
              {label}
            </p>
            <p className="text-xs text-[#6B6B76] mt-0.5">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
