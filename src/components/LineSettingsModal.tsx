import React from 'react';
import { User } from '../types';
import { NotificationSettingsModal } from './NotificationSettingsModal';

export interface LineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  initialTab?: 'webpush' | 'line';
}

export const LineSettingsModal: React.FC<LineSettingsModalProps> = (props) => {
  return <NotificationSettingsModal {...props} />;
};

export default LineSettingsModal;
