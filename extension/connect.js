const msg = document.getElementById('msg')
const allow = document.getElementById('allow')

async function refresh() {
  const granted = await chrome.permissions.contains({ permissions: ['history'] })
  if (granted) {
    allow.textContent = 'Access granted ✓'
    allow.disabled = true
    msg.textContent = 'Returning you to your dashboard…'
  }
  return granted
}

allow.addEventListener('click', async () => {
  // Must run directly inside the click handler: Chrome only shows the prompt for a user gesture.
  const granted = await chrome.permissions.request({ permissions: ['history'] })
  if (!granted) {
    msg.textContent = 'Permission was not granted. Nothing was read.'
    return
  }
  await refresh()
  await chrome.runtime.sendMessage({ type: 'granted' })
  setTimeout(() => window.close(), 600)
})

document.getElementById('cancel').addEventListener('click', () => window.close())
refresh()
