import { useCallback, useEffect, useState } from "react";
import { api, type AppNotification } from "../../api";

// HU-19: avisos de pedidos nuevos en el panel (se actualizan cada 30 s).
export function Notifications() {
  const [data, setData] = useState<{ items: AppNotification[]; unread: number }>({ items: [], unread: 0 });

  const load = useCallback(() => api<{ items: AppNotification[]; unread: number }>("/notifications").then(setData).catch(() => undefined), []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function read(n: AppNotification) {
    await api(`/notifications/${n.id}/read`, { method: "POST" });
    load();
  }

  if (!data.items.length) return null;
  return (
    <section className="card notifications" aria-label="Notificaciones">
      <h2>
        Avisos {data.unread > 0 && <span className="count">{data.unread}</span>}
      </h2>
      <ul className="list">
        {data.items.slice(0, 5).map((n) => (
          <li key={n.id} className={n.readAt ? "muted" : ""}>
            <strong>{n.title}</strong> <span>{n.body}</span>
            {!n.readAt && (
              <button className="link" onClick={() => read(n)}>
                Marcar como leído
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
