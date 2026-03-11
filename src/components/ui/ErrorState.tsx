import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function ErrorState({ title, message, actionLabel, onAction }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="bg-red-50 p-4 rounded-full mb-4">
                <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">{message}</p>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
