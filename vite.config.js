import { defineConfig } from 'vite';

export default defineConfig({
  // 🔴 بسیار مهم: این خط باعث می‌شود فایل‌های JS، CSS، تصاویر و MP3 در GitHub Pages درست لود شوند.
  // چون نام ریپازیتوری شما happybirthday است، این مسیر باید دقیقاً به این شکل باشد.
  base: '/happybirthday/',

  // تنظیمات بهینه‌سازی وابستگی‌ها برای جلوگیری از خطاهای Three.js
  optimizeDeps: {
    exclude: [
      'three-mesh-bvh',
      'three/addons/renderers/webgl/nodes/WebGLNodes.js',
      'three-subdivide',
      'web-ifc-three',
      'web-ifc',
      'three-bvh-csg',
      'three-gpu-pathtracer',
      'flow',
      'three/addons/loaders/IFCLoader.js',
    ],
  },
});
