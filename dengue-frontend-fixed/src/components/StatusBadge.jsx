import React from 'react';

const STATUS_CONFIG = {
  Pending: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
    label: 'Unassigned',
  },
  Assigned: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
    label: 'Assigned',
  },
  'Pending Verification': {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    dot: 'bg-purple-500',
    label: 'Awaiting Verification',
  },
  Resolved: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    dot: 'bg-green-500',
    label: 'Completed',
  },
  Rejected: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-500',
    label: 'Rejected',
  },
  'Re-assigned': {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    dot: 'bg-red-500',
    label: 'Re-assigned',
  },
};

const LANDING_STATUS_CONFIG = {
  Pending: { className: 'da-status--pending', label: 'Unassigned' },
  Assigned: { className: 'da-status--assigned', label: 'Assigned' },
  'Pending Verification': { className: 'da-status--verification', label: 'Awaiting Verification' },
  Resolved: { className: 'da-status--resolved', label: 'Completed' },
  'Re-assigned': { className: 'da-status--reassigned', label: 'Re-assigned' },
  Rejected: { className: 'da-status--reassigned', label: 'Rejected' },
};

const DEFAULT = {
  bg: 'bg-gray-100',
  text: 'text-gray-700',
  border: 'border-gray-300',
  dot: 'bg-gray-400',
  label: 'Unknown',
};

const StatusBadge = ({ status, size = 'md', theme = 'default' }) => {
  if (theme === 'landing') {
    const config = LANDING_STATUS_CONFIG[status] || { className: 'da-status--unknown', label: status || 'Unknown' };
    return (
      <span className={`da-status-badge ${config.className}${size === 'sm' ? ' da-status-badge--sm' : ''}`}>
        <span className="da-status-dot" />
        {config.label}
      </span>
    );
  }

  const config = STATUS_CONFIG[status] || { ...DEFAULT, label: status || 'Unknown' };
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-3 py-1 text-sm gap-1.5';

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
      <span className={`rounded-full flex-shrink-0 ${config.dot} ${size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'}`} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
