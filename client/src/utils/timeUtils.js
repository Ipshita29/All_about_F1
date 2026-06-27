export function formatSessionTime(date, time) {
    if (!date) return "TBA";
    if (!time) {
        return new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "short",
            day: "numeric",
            month: "short",
        });
    }
    return new Date(`${date}T${time}`).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}