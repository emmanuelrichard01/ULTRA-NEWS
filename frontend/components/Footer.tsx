export default function Footer() {
    return (
        <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0">
                        <span className="text-xl font-bold text-gray-900">ULTRA-NEWS</span>
                        <p className="text-gray-500 text-sm mt-1">Aggregating the world's knowledge.</p>
                    </div>
                    <div className="flex space-x-6 text-gray-400 hover:text-gray-500">
                        <a href="#" className="text-sm">Privacy Policy</a>
                        <a href="#" className="text-sm">Terms of Service</a>
                        <a href="#" className="text-sm">Contact</a>
                    </div>
                </div>
                <div className="mt-8 border-t border-gray-200 pt-8 text-center text-sm text-gray-400">
                    &copy; {new Date().getFullYear()} Ultra News Inc. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
