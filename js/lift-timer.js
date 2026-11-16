export function timerState(end, now = Date.now()) {
  const left = Math.ceil((end - now) / 1000);
  const seconds = left > 0 ? left : Math.floor(Math.max(0, now - end) / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return { expired: now >= end, label: left > 0 ? `Rest ${time}` : `Rest complete · +${time}` };
}
export function adjustedDeadline(end, deltaSeconds, now = Date.now()) {
  return Math.max(now, Math.max(now, end) + deltaSeconds * 1000);
}
