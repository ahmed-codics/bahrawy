'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import './whatsapp-widget.css';

const supportUrl =
  'https://wa.me/201109663305?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%83%D9%88%D8%B1%D8%B3%D8%A7%D8%AA%20%D8%A3%D9%83%D8%A7%D8%AF%D9%8A%D9%85%D9%8A%D8%A9%20%D8%A7%D9%84%D8%B3%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A8%D8%AD%D8%B1%D8%A7%D9%88%D9%8A.';

export function WhatsAppWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768 || sessionStorage.getItem('whatsapp_widget_closed')) return;
    const timer = window.setTimeout(() => setOpen(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);

  const close = () => {
    setOpen(false);
    sessionStorage.setItem('whatsapp_widget_closed', 'true');
  };

  return (
    <aside className="wa-widget" aria-label="التواصل مع الدعم">
      {open && (
        <div className="wa-card">
          <button type="button" className="wa-close" onClick={close} aria-label="إغلاق">
            <X aria-hidden="true" />
          </button>
          <p className="wa-title">أهلاً بك في أكاديمية مستر السيد البحراوي</p>
          <p className="wa-copy">محتاج مساعدة تختار الكورس المناسب؟ فريق الدعم جاهز يساعدك.</p>
          <a href={supportUrl} target="_blank" rel="noreferrer" className="wa-action">
            <MessageCircle aria-hidden="true" />
            تواصل معنا عبر واتساب
          </a>
        </div>
      )}
      <button
        type="button"
        className="wa-fab"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'إغلاق نافذة الدعم' : 'تواصل مع الدعم'}
        aria-expanded={open}
      >
        {open ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
      </button>
    </aside>
  );
}
