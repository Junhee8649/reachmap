import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 는 `<사용자>.github.io/<레포이름>/` 아래로 서빙하므로 base 를 맞춰야 한다.
// 🔴 레포 이름을 바꾸면 이 값도 바꾼다. 안 맞으면 화면은 뜨는데 CSS·JS 가 404 로 죽는다.
// dev 서버는 `/` 로 두어 `npm run dev` 가 그대로 동작하게 한다.
const 레포이름 = 'reachmap'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${레포이름}/` : '/',
  plugins: [react()],
}))
