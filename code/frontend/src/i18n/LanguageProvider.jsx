import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import bengali from './bn.json';
import './language.css';

const LanguageContext = createContext({ language: 'en', setLanguage: () => {} });

// Translate only application UI copy. Unknown/user-entered descriptions stay untouched.
// The adapter is deliberately isolated so existing pages, state, handlers and API calls
// need no changes. It handles strings created later by async React rendering too.
function translateString(value, language) {
  if (language !== 'bn' || !value || !/[a-z]/i.test(value)) return value;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  let output = bengali[trimmed];

  if (!output) {
    let found = trimmed.match(/^(\d+)\s+total complaints?$/i);
    if (found) output = `${found[1]}টি মোট অভিযোগ`;
    found = !output && trimmed.match(/^(\d+)\s+shown$/i);
    if (found) output = `${found[1]}টি দেখানো হচ্ছে`;
    found = !output && trimmed.match(/^(\d+)\s+(active tasks?|tasks?|reports?)$/i);
    if (found) output = `${found[1]}টি ${found[2].includes('active') ? 'সক্রিয় কাজ' : found[2].includes('report') ? 'অভিযোগ' : 'কাজ'}`;
    found = !output && trimmed.match(/^Ward\s+(\d+)(.*)$/i);
    if (found) output = `ওয়ার্ড ${found[1]}${found[2] || ''}`;
    found = !output && trimmed.match(/^Complaint\s+#(\d+)$/i);
    if (found) output = `অভিযোগ #${found[1]}`;
    found = !output && trimmed.match(/^Task\s+#(\d+)$/i);
    if (found) output = `কাজ #${found[1]}`;
    found = !output && trimmed.match(/^(Submitted|Assigned|Captured):?\s+(.+)$/i);
    if (found) output = `${{Submitted:'জমা দেওয়া হয়েছে', Assigned:'দায়িত্ব দেওয়া হয়েছে', Captured:'ধরা হয়েছে'}[found[1]] || found[1]}: ${found[2]}`;
    found = !output && trimmed.match(/^Assign\s+(.+)$/i);
    if (found) output = `${found[1]}-কে দায়িত্ব দিন`;
    found = !output && trimmed.match(/^(\d+)\s*\/1000 characters$/i);
    if (found) output = `${found[1]}/১০০০ অক্ষর`;
    found = !output && trimmed.match(/^Complaints submitted in the last 24 hours:\s*(\d+) of 3\.$/i);
    if (found) output = `গত ২৪ ঘণ্টায় জমা অভিযোগ: ${found[1]}/৩টি।`;
    found = !output && trimmed.match(/^Report\s+#(\d+)$/i);
    if (found) output = `প্রতিবেদন #${found[1]}`;
    found = !output && trimmed.match(/^Submitted:\s*(.+)$/i);
    if (found) output = `জমা দেওয়া হয়েছে: ${found[1]}`;
  }

  if (!output) return value;
  const lead = value.match(/^\s*/)[0];
  const tail = value.match(/\s*$/)[0];
  return lead + output + tail;
}

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem('dengue-alert-language') === 'bn' ? 'bn' : 'en'; }
    catch (_) { return 'en'; }
  });
  const textMemory = useRef(new WeakMap());
  const attributeMemory = useRef(new WeakMap());

  useEffect(() => {
    try { localStorage.setItem('dengue-alert-language', language); } catch (_) {}
    document.documentElement.lang = language;
    const root = document.getElementById('root');
    if (!root) return undefined;

    const translateTextNode = (node) => {
      const current = node.nodeValue;
      let memory = textMemory.current.get(node);
      if (!memory || (current !== memory.display && current !== memory.original)) {
        memory = { original: current, display: current };
        textMemory.current.set(node, memory);
      }
      const next = translateString(memory.original, language);
      if (current !== next) node.nodeValue = next;
      memory.display = next;
    };

    const translateAttributes = (element) => {
      const attributes = ['placeholder', 'aria-label', 'title', 'alt'];
      let records = attributeMemory.current.get(element);
      if (!records) {
        records = {};
        attributeMemory.current.set(element, records);
      }
      for (const attribute of attributes) {
        const current = element.getAttribute(attribute);
        if (current == null) continue;
        let record = records[attribute];
        if (!record || (record.display !== current && record.original !== current)) {
          record = { original: current, display: current };
          records[attribute] = record;
        }
        const next = translateString(record.original, language);
        if (next !== current) element.setAttribute(attribute, next);
        record.display = next;
      }
    };

    let observer;
    const apply = () => {
      // Avoid recursively responding to our own translation updates.
      if (observer) observer.disconnect();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let node = walker.currentNode;
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.parentElement?.closest('.da-language-switcher, script, style, textarea, [translate="no"], .da-complaint-description')) {
            translateTextNode(node);
          }
        } else if (node.nodeType === Node.ELEMENT_NODE && !node.closest('.da-language-switcher')) {
          translateAttributes(node);
        }
        node = walker.nextNode();
      }
      if (observer) observer.observe(root, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ['placeholder', 'aria-label', 'title', 'alt']
      });
    };

    let pending = false;
    observer = new MutationObserver(() => {
      if (!pending) {
        pending = true;
        Promise.resolve().then(() => { pending = false; apply(); });
      }
    });
    apply();
    return () => observer.disconnect();
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
      <LanguageSwitcher />
    </LanguageContext.Provider>
  );
}

export function useLanguage() { return useContext(LanguageContext); }

function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="da-language-switcher" role="group" aria-label="Language / ভাষা">
      <button type="button" lang="en" aria-pressed={language === 'en'}
        className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
      <button type="button" lang="bn" aria-pressed={language === 'bn'}
        className={language === 'bn' ? 'active' : ''} onClick={() => setLanguage('bn')}>বাংলা</button>
    </div>
  );
}
