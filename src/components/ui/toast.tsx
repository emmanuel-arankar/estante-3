import { toast } from 'react-hot-toast';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export function toastSuccessClickable(message: string, options?: { id?: string }) {
  toast.custom((t) => (
    <div
      className={`max-w-sm w-full bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-md flex items-center space-x-3 transition-all cursor-pointer ${
        t.visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => toast.dismiss(t.id)}
    >
      <CheckCircle className="w-5 h-5" />
      <span className="text-sm">{message}</span>
    </div>
  ), { id: options?.id });
}

export function toastErrorClickable(message: string, options?: { id?: string }) {
  toast.custom((t) => (
    <div
      className={`max-w-sm w-full bg-red-600 text-white px-4 py-3 rounded-lg shadow-md flex items-center space-x-3 transition-all cursor-pointer ${
        t.visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => toast.dismiss(t.id)}
    >
      <XCircle className="w-5 h-5" />
      <span className="text-sm">{message}</span>
    </div>
  ), { id: options?.id });
}

export function toastInfoClickable(message: string, options?: { id?: string }) {
  toast.custom((t) => (
    <div
      className={`max-w-sm w-full bg-blue-600 text-white px-4 py-3 rounded-lg shadow-md flex items-center space-x-3 transition-all cursor-pointer ${
        t.visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={() => toast.dismiss(t.id)}
    >
      <Info className="w-5 h-5" />
      <span className="text-sm">{message}</span>
    </div>
  ), { id: options?.id });
}