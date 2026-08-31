// postForm performs a full-page POST by synthesizing and submitting a hidden form.
// Used for the GitHub App manifest flow: GitHub's manifest-conversion endpoint requires a
// form POST (with the manifest JSON as a field) that navigates the browser to github.com —
// it cannot be an XHR/fetch because the response is an interactive GitHub page.
export function postForm(url: string, fields: Record<string, string>) {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}
