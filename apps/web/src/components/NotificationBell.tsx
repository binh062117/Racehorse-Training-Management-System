import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { Notification, Paginated } from '../lib/types';
import { BellIcon } from './Icons';

const POLL_MS = 20_000;
// Notification.type carries no severity field — AI_RISK_ALERT is the one
// type that always means "VET/GROOM already confirmed something serious",
// so it's the one that gets the attention animation.
const URGENT_TYPES = new Set(['AI_RISK_ALERT']);

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Notification | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [recentRes, unreadRes] = await Promise.all([
        api.get<Paginated<Notification>>('/notifications', {
          params: { type: 'AI_RISK_ALERT', limit: 8 },
        }),
        api.get<Paginated<Notification>>('/notifications', {
          params: { type: 'AI_RISK_ALERT', unread: true, limit: 1 },
        }),
      ]);
      setItems(recentRes.data.data);
      setUnreadCount(unreadRes.data.meta.total);
    } catch {
      // Silent — the bell just shows stale data until the next poll.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    const onChanged = () => void load();
    window.addEventListener('notifications:changed', onChanged);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications:changed', onChanged);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const hasUrgentUnread = items.some((n) => !n.read && URGENT_TYPES.has(n.type));

  const openDetail = async (n: Notification) => {
    setOpen(false);
    setDetail(n);
    if (!n.read) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        window.dispatchEvent(new Event('notifications:changed'));
      } catch {
        // Not critical — user still sees the message in the modal.
      }
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      window.dispatchEvent(new Event('notifications:changed'));
      setDetail((current) => (current?.id === id ? null : current));
    } catch {
      // Ignore — the row simply stays until the next successful poll/retry.
    }
  };

  return (
    <div className="notif-bell" ref={containerRef}>
      <button
        type="button"
        className={`notif-bell-btn${hasUrgentUnread ? ' urgent' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Thông báo"
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notif-bell-count">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-head">Thông báo</div>
          {items.length === 0 ? (
            <div className="notif-dropdown-empty">Chưa có thông báo nào.</div>
          ) : (
            <ul className="notif-dropdown-list">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`notif-dropdown-item${!n.read ? ' unread' : ''}${URGENT_TYPES.has(n.type) ? ' urgent' : ''}`}
                  onClick={() => void openDetail(n)}
                >
                  <div className="notif-dropdown-msg">{n.message}</div>
                  <div className="notif-dropdown-meta">
                    <span className="muted small">{formatDateTime(n.createdAt)}</span>
                    <button
                      type="button"
                      className="notif-dropdown-del"
                      aria-label="Xoá thông báo"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(n.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="notif-dropdown-viewall"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            Xem tất cả
          </button>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Chi tiết thông báo</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDetail(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 10px', lineHeight: 1.6 }}>{detail.message}</p>
              <span className="muted small">{formatDateTime(detail.createdAt)}</span>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void remove(detail.id)}
              >
                Xoá
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setDetail(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
