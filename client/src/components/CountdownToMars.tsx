import { useEffect, useState } from 'react';

// Estimated arrival at Mars: 21 Jun 2036.
const ARRIVAL = Date.UTC(2036, 5, 21);

interface Remaining {
  years: number;
  months: number;
  days: number;
  hours: number;
  mins: number;
  secs: number;
}

// Calendar-accurate breakdown (years/months vary in length), borrowing from the
// next-larger unit when a field goes negative.
function remaining(): Remaining | null {
  const now = new Date();
  const target = new Date(ARRIVAL);
  if (target.getTime() <= now.getTime()) return null;

  let years = target.getUTCFullYear() - now.getUTCFullYear();
  let months = target.getUTCMonth() - now.getUTCMonth();
  let days = target.getUTCDate() - now.getUTCDate();
  let hours = target.getUTCHours() - now.getUTCHours();
  let mins = target.getUTCMinutes() - now.getUTCMinutes();
  let secs = target.getUTCSeconds() - now.getUTCSeconds();

  if (secs < 0) ((secs += 60), (mins -= 1));
  if (mins < 0) ((mins += 60), (hours -= 1));
  if (hours < 0) ((hours += 24), (days -= 1));
  if (days < 0) {
    // Borrow the length of the month preceding the target month.
    const daysInPrevMonth = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), 0),
    ).getUTCDate();
    days += daysInPrevMonth;
    months -= 1;
  }
  if (months < 0) ((months += 12), (years -= 1));

  return { years, months, days, hours, mins, secs };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Live countdown to the ship's arrival at Mars. Compact on small screens. */
export default function CountdownToMars() {
  const [time, setTime] = useState<Remaining | null>(remaining);

  useEffect(() => {
    const id = setInterval(() => setTime(remaining()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      title="Estimated arrival at Mars · 21 Jun 2036"
      className="whitespace-nowrap text-[0.6rem] leading-tight tracking-[0.02em] text-[#9fb3d8] sm:text-[0.8rem]"
    >
      <span aria-hidden>🪐</span>{' '}
      {time ? (
        <>
          <span className="hidden sm:inline">Mars in </span>
          <strong className="text-[#bcd4ff]">
            {time.years}y {time.months}m {time.days}d
          </strong>{' '}
          {pad(time.hours)}:{pad(time.mins)}:{pad(time.secs)}
        </>
      ) : (
        <span className="text-[#8ef5b0]">Arrived at Mars 🎉</span>
      )}
    </span>
  );
}
