<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GetGitRepoConfig, GetGitProviders, UpsertGitRepoConfig, TestGitRepoConnection, GetCPIApiEndpoints, GetGitOwners, GetGitRepos, StartGitAppManifest, GetGitAppRepos, DisconnectGitApp } from '@/service/api'
import type { GitRepoConfig, GitOwnerInfo, GitRepoInfo, ApiEndpoint } from '@/service/model'
import { postForm } from '@/service/formSubmit'

import "@ui5/webcomponents/dist/Button.js"
import "@ui5/webcomponents/dist/BusyIndicator.js"
import "@ui5/webcomponents/dist/Panel.js"
import "@ui5/webcomponents/dist/Tag.js"
import "@ui5/webcomponents/dist/Text.js"
import "@ui5/webcomponents/dist/Title.js"
import "@ui5/webcomponents/dist/Label.js"
import "@ui5/webcomponents/dist/Link.js"
import "@ui5/webcomponents/dist/Input.js"
import "@ui5/webcomponents/dist/CheckBox.js"
import "@ui5/webcomponents/dist/Dialog.js"
import "@ui5/webcomponents/dist/Toolbar.js"
import "@ui5/webcomponents/dist/ToolbarButton.js"
import "@ui5/webcomponents/dist/MessageStrip.js"
import "@ui5/webcomponents/dist/Select.js"
import "@ui5/webcomponents/dist/Option.js"
import "@ui5/webcomponents/dist/ComboBox.js"
import "@ui5/webcomponents/dist/ComboBoxItem.js"
import "@ui5/webcomponents-icons/dist/edit.js"
import "@ui5/webcomponents-icons/dist/connected.js"

// Maps a test/connectivity status to a UI5 tag design. Local to this card so it
// stays self-contained (the parent view has its own copy for other sections).
const statusDesign = (status?: string): string => {
  if (status === 'ok') return 'Positive'
  if (status === 'error') return 'Negative'
  return 'Neutral'
}

// ── Git Repository Config ────────────────────────────────────────────────────

const emptyGitConfig = (): GitRepoConfig => ({ authMethod: 'pat', provider: 'github', destinationName: '', owner: '', repo: '', enabled: false })

const gitConfig = ref<GitRepoConfig>(emptyGitConfig())
const gitConfigLoading = ref(false)
const showGitEditDialog = ref(false)
const gitEditForm = ref<GitRepoConfig>(emptyGitConfig())
const gitSaving = ref(false)
const gitTestResult = ref<{ status: string; message: string } | null>(null)
const gitTesting = ref(false)

// Cascading dropdown data
const destinations = ref<ApiEndpoint[]>([])
const gitProviders = ref<string[]>([])
const gitOwners = ref<GitOwnerInfo[]>([])
const gitRepos = ref<GitRepoInfo[]>([])
const gitOwnersLoading = ref(false)
const gitReposLoading = ref(false)

// ── GitHub App flow ──────────────────────────────────────────────────────────
// The dialog's auth-method selector. github_app cannot be "set" directly by the
// client — it becomes active only after the manifest registration flow completes
// (the backend callback flips AuthMethod). See handler/git_app_manifest.go.
const gitAuthMethod = ref<'pat' | 'github_app'>('pat')

// Registration form inputs (state a: not yet registered).
const appGithubUrl = ref('')          // empty → public github.com
const appAccountType = ref<'user' | 'org'>('user')
const appOrg = ref('')
const appRegistering = ref(false)

// Read-back repo picker (state c: installed).
const appRepos = ref<GitRepoInfo[]>([])
const appReposLoading = ref(false)
const appInstalled = ref(false)     // GetGitAppRepos succeeded → installation granted
const appInstallPending = ref(false) // GetGitAppRepos 409 → registered but not installed (state b)

// An App is registered once the persisted config carries an App ID (callback-authored).
const appRegistered = computed(() => !!gitConfig.value.githubAppId)

// ── GitHub App exit mechanism ────────────────────────────────────────────────
// Disconnect uninstalls the installation, deletes the auto-created destination, and
// unbinds the config. Deleting the App *registration* on GitHub is UI-only, so on
// success the backend returns an Advanced-page deep-link we surface for the admin.
const showDisconnectDialog = ref(false)
const disconnecting = ref(false)
const disconnectAdvancedUrl = ref('')

const openDisconnectDialog = () => {
  disconnectAdvancedUrl.value = ''
  showDisconnectDialog.value = true
}

const onConfirmDisconnect = async () => {
  disconnecting.value = true
  try {
    const result = await DisconnectGitApp()
    disconnectAdvancedUrl.value = result.advancedUrl
    // Local state is now unbound — reflect the unconfigured state in the card/dialog.
    gitConfig.value = emptyGitConfig()
    gitEditForm.value = emptyGitConfig()
    appInstalled.value = false
    appInstallPending.value = false
    appRepos.value = []
    showGitEditDialog.value = false
    window.$toast.success('GitHub App disconnected')
  } catch { /* Error displayed by http interceptor */ } finally {
    disconnecting.value = false
  }
}


// Save is valid only when the active mode has a complete selection. In github_app
// mode that means an installed App with a chosen repo; the machine fields are the
// backend's responsibility.
const gitSaveDisabled = computed(() => {
  if (gitSaving.value) return true
  if (gitAuthMethod.value === 'github_app') return !appInstalled.value || !gitEditForm.value.repo
  return !gitEditForm.value.destinationName || !gitEditForm.value.owner || !gitEditForm.value.repo
})

const loadDestinations = async () => {
  try {
    destinations.value = await GetCPIApiEndpoints() || []
  } catch { /* ignore */ }
}

const loadGitProviders = async () => {
  try {
    gitProviders.value = await GetGitProviders() || []
  } catch { /* ignore */ }
}

const onGitProviderChange = (provider: string) => {
  gitEditForm.value.provider = provider
  // Reset all downstream selections
  gitEditForm.value.destinationName = ''
  gitEditForm.value.owner = ''
  gitEditForm.value.repo = ''
  gitOwners.value = []
  gitRepos.value = []
}

const onGitDestinationChange = async (destName: string) => {
  gitEditForm.value.destinationName = destName
  // Reset downstream selections
  gitEditForm.value.owner = ''
  gitEditForm.value.repo = ''
  gitOwners.value = []
  gitRepos.value = []
  if (!destName) return
  // Fetch owners for this destination
  gitOwnersLoading.value = true
  try {
    gitOwners.value = await GetGitOwners(gitEditForm.value.provider, destName)
  } catch { /* error shown by interceptor */ } finally {
    gitOwnersLoading.value = false
  }
}

const onGitOwnerChange = async (owner: string) => {
  gitEditForm.value.owner = owner
  // Reset repo
  gitEditForm.value.repo = ''
  gitRepos.value = []
  if (!owner || !gitEditForm.value.destinationName) return
  const ownerInfo = gitOwners.value.find(o => o.login === owner)
  if (!ownerInfo) return
  // Fetch repos for this owner
  gitReposLoading.value = true
  try {
    gitRepos.value = await GetGitRepos(gitEditForm.value.provider, gitEditForm.value.destinationName, owner, ownerInfo.type)
  } catch { /* error shown by interceptor */ } finally {
    gitReposLoading.value = false
  }
}

const loadGitConfig = async () => {
  gitConfigLoading.value = true
  try {
    const config = await GetGitRepoConfig()
    if (config && config.provider) {
      gitConfig.value = config
    }
  } catch { /* ignore */ } finally {
    gitConfigLoading.value = false
  }
}

const openGitEditDialog = async () => {
  gitEditForm.value = { ...gitConfig.value }
  gitAuthMethod.value = gitConfig.value.authMethod === 'github_app' ? 'github_app' : 'pat'
  gitOwners.value = []
  gitRepos.value = []
  showGitEditDialog.value = true

  if (gitAuthMethod.value === 'github_app') {
    if (appRegistered.value) await loadAppRepos()
    return
  }

  // PAT: pre-load cascading data for existing config
  if (gitEditForm.value.destinationName) {
    gitOwnersLoading.value = true
    try {
      gitOwners.value = await GetGitOwners(gitEditForm.value.provider, gitEditForm.value.destinationName)
    } catch { /* ignore */ } finally {
      gitOwnersLoading.value = false
    }
    if (gitEditForm.value.owner) {
      const ownerInfo = gitOwners.value.find(o => o.login === gitEditForm.value.owner)
      if (ownerInfo) {
        gitReposLoading.value = true
        try {
          gitRepos.value = await GetGitRepos(gitEditForm.value.provider, gitEditForm.value.destinationName, gitEditForm.value.owner, ownerInfo.type)
        } catch { /* ignore */ } finally {
          gitReposLoading.value = false
        }
      }
    }
  }
}

// Switch the dialog's auth-method view. Selecting github_app loads the read-back
// repos when an App is already registered; otherwise the registration form shows.
const onGitAuthMethodChange = async (method: 'pat' | 'github_app') => {
  gitAuthMethod.value = method
  if (method === 'github_app' && appRegistered.value) {
    await loadAppRepos()
  }
}

// loadAppRepos drives the App-mode 3-state UI: success → installed (repo picker);
// 409 → registered-but-not-installed (install-pending guidance); other → left in
// the registration state.
const loadAppRepos = async () => {
  appRepos.value = []
  appInstalled.value = false
  appInstallPending.value = false
  appReposLoading.value = true
  try {
    appRepos.value = await GetGitAppRepos()
    appInstalled.value = true
  } catch (e: any) {
    if (e?.status === 409) appInstallPending.value = true
  } finally {
    appReposLoading.value = false
  }
}

// startAppRegistration kicks off the manifest flow: fetch the manifest + POST
// target, then submit a hidden form that navigates the browser to GitHub. The
// backend callbacks author the App identity and 302 back to the SPA with
// ?openGitDialog=1 (this card reopens the dialog on its next mount).
const startAppRegistration = async () => {
  if (appAccountType.value === 'org' && !appOrg.value.trim()) {
    window.$toast.warning('Organization name is required for org-owned Apps')
    return
  }
  appRegistering.value = true
  try {
    const { postUrl, manifest } = await StartGitAppManifest(appGithubUrl.value.trim(), appAccountType.value, appOrg.value.trim())
    postForm(postUrl, { manifest }) // navigates away to GitHub
  } catch {
    appRegistering.value = false
  }
}

const onSaveGitConfig = async () => {
  gitSaving.value = true
  try {
    // In github_app mode the backend is the source of truth for the machine-owned
    // fields (destination/owner/appId/installationId); it applies ONLY repo+enabled.
    // We still send the persisted machine fields to satisfy the type — they are ignored.
    const payload: GitRepoConfig = gitAuthMethod.value === 'github_app'
      ? { ...gitConfig.value, authMethod: 'github_app', repo: gitEditForm.value.repo, enabled: gitEditForm.value.enabled }
      : { ...gitEditForm.value, authMethod: 'pat' }
    const result = await UpsertGitRepoConfig(payload)
    gitConfig.value = result.config
    if (result.warning) {
      window.$toast.warning(result.warning)
    } else {
      window.$toast.success('Git repository config saved')
    }
    showGitEditDialog.value = false
  } catch { /* Error displayed by http interceptor */ } finally {
    gitSaving.value = false
  }
}

const onTestGitConnection = async () => {
  gitTesting.value = true
  gitTestResult.value = null
  try {
    gitTestResult.value = await TestGitRepoConnection()
  } catch (e: any) {
    gitTestResult.value = { status: 'error', message: e?.message ?? 'test failed' }
  } finally {
    gitTesting.value = false
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  await Promise.allSettled([loadGitConfig(), loadGitProviders(), loadDestinations()])
  // Auto-open the Git dialog after the GitHub App manifest flow redirects back.
  // The backend lands on this page directly with ?openGitDialog=1 on success
  // (App.vue's generic toast handler shows the success toast and strips toast/msg,
  // leaving this flag). Clear the flag so a refresh doesn't reopen it.
  if (route.query.openGitDialog) {
    const rest = { ...route.query }
    delete rest.openGitDialog
    router.replace({ query: rest })
    await openGitEditDialog()
  }
})
</script>

<template>
  <!-- Disconnect GitHub App: confirm phase, then a "finish on GitHub" phase once the
       backend returns the Advanced-page deep-link (App-registration delete is UI-only). -->
  <ui5-dialog header-text="Disconnect GitHub App" :open="showDisconnectDialog"
    @before-close="showDisconnectDialog = false" style="width: 34rem;">
    <div class="sc-dialog-content">
      <template v-if="!disconnectAdvancedUrl">
        <ui5-message-strip design="Negative" hide-close-button>
          This cannot be undone. Synced history already on GitHub is not removed.
        </ui5-message-strip>

        <ui5-title level="H6" size="H6" style="margin-top: 0.75rem;">Performed automatically when you
          confirm</ui5-title>
        <ui5-text>1. Uninstall the GitHub App installation (revokes its repository access).</ui5-text>
        <ui5-text>2. Delete the stored App private key (the auto-created destination).</ui5-text>
        <ui5-text>3. Unbind the repository configuration in this app.</ui5-text>

        <ui5-title level="H6" size="H6" style="margin-top: 0.75rem;">Requires a manual step on GitHub
          afterwards</ui5-title>
        <ui5-text>Delete the App registration — GitHub has no API for this. After you confirm, we'll show a deep-link to
          the App's Advanced settings page; open it and click "Delete GitHub App".</ui5-text>
      </template>
      <template v-else>
        <ui5-message-strip design="Positive" hide-close-button style="margin-bottom: 0.75rem;">
          GitHub App disconnected. To fully delete the App registration on GitHub, open its
          Advanced settings page and click "Delete GitHub App".
        </ui5-message-strip>
        <ui5-label>App Advanced settings</ui5-label>
        <ui5-link :href="disconnectAdvancedUrl" target="_blank">{{ disconnectAdvancedUrl }}</ui5-link>
      </template>
    </div>
    <ui5-toolbar slot="footer">
      <template v-if="!disconnectAdvancedUrl">
        <ui5-toolbar-button design="Negative" text="I Confirm to Disconnect" :disabled="disconnecting"
          @click="onConfirmDisconnect" />
        <ui5-toolbar-button design="Transparent" text="Cancel" @click="showDisconnectDialog = false" />
      </template>
      <ui5-toolbar-button v-else design="Emphasized" text="Close" @click="showDisconnectDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <!-- Edit Git Repository Config Dialog -->
  <ui5-dialog header-text="Configure Git Repository" :open="showGitEditDialog" @before-close="showGitEditDialog = false"
    style="width: 36rem;">
    <div class="sc-dialog-content">
      <ui5-label required>Authentication Method</ui5-label>
      <ui5-select style="width: 100%;" @change="onGitAuthMethodChange(($event as any).detail.selectedOption.value)">
        <ui5-option value="pat" :selected="gitAuthMethod === 'pat'">Personal Access Token</ui5-option>
        <ui5-option value="github_app" :selected="gitAuthMethod === 'github_app'">GitHub App</ui5-option>
      </ui5-select>

      <!-- PAT mode: client authors the full connection (provider + destination + owner + repo). -->
      <template v-if="gitAuthMethod === 'pat'">
        <ui5-label required style="margin-top: 0.75rem;">Provider</ui5-label>
        <ui5-select style="width: 100%;" @change="onGitProviderChange(($event as any).detail.selectedOption.value)">
          <ui5-option v-for="p in gitProviders" :key="p" :value="p" :selected="gitEditForm.provider === p">{{ p
            }}</ui5-option>
        </ui5-select>

        <ui5-label required style="margin-top: 0.75rem;">Destination</ui5-label>
        <ui5-combobox style="width: 100%;" placeholder="Search Git Destinations..." filter="Contains"
          :selected-value="gitEditForm.destinationName"
          @selection-change="onGitDestinationChange(($event as any).detail.item?.getAttribute('value') || '')">
          <ui5-cb-item v-for="d in destinations" :key="d.name" :text="d.name" :value="d.name"></ui5-cb-item>
        </ui5-combobox>

        <ui5-label required style="margin-top: 0.75rem;">Owner</ui5-label>
        <ui5-busy-indicator :active="gitOwnersLoading" :delay="0" size="S" style="width: 100%;">
          <ui5-combobox style="width: 100%;" placeholder="Search Owner..." filter="Contains"
            :selected-value="gitEditForm.owner" :disabled="gitOwners.length === 0 && !gitOwnersLoading"
            :loading="gitOwnersLoading"
            @selection-change="onGitOwnerChange(($event as any).detail.item?.getAttribute('value') || '')">
            <ui5-cb-item v-for="o in gitOwners" :key="o.login" :text="`${o.login} (${o.type})`"
              :value="o.login"></ui5-cb-item>
          </ui5-combobox>
        </ui5-busy-indicator>

        <ui5-label required style="margin-top: 0.75rem;">Repository</ui5-label>
        <ui5-busy-indicator :active="gitReposLoading" :delay="0" size="S" style="width: 100%;">
          <ui5-combobox style="width: 100%;" placeholder="Search Repository..." filter="Contains"
            :selected-value="gitEditForm.repo" :disabled="gitRepos.length === 0 && !gitReposLoading"
            :loading="gitReposLoading"
            @selection-change="gitEditForm.repo = ($event as any).detail.item?.getAttribute('value') || ''">
            <ui5-cb-item v-for="r in gitRepos" :key="r.name" :text="r.private ? `${r.name} (private)` : r.name"
              :value="r.name"></ui5-cb-item>
          </ui5-combobox>
        </ui5-busy-indicator>

        <ui5-checkbox style="margin-top: 0.75rem;" :checked="gitEditForm.enabled"
          @change="gitEditForm.enabled = ($event as any).target.checked" text="Enabled" />
      </template>

      <!-- GitHub App mode: three states — installed (repo read-back), install-pending, not-registered. -->
      <template v-else>
        <ui5-busy-indicator :active="appReposLoading" :delay="0" size="M"
          style="width: 100%; display: block; margin-top: 0.75rem;">
          <div class="app-form">
            <!-- state c: installed → pick from the repos the installation was granted -->
            <template v-if="appInstalled">
              <ui5-message-strip design="Positive" hide-close-button style="margin-bottom: 0.75rem;">
                GitHub App installed. Select one of the repositories the installation was granted.
              </ui5-message-strip>
              <ui5-label required>Repository</ui5-label>
              <ui5-combobox style="width: 100%;" placeholder="Search Repository..." filter="Contains"
                :selected-value="gitEditForm.repo" :disabled="appRepos.length === 0"
                @selection-change="gitEditForm.repo = ($event as any).detail.item?.getAttribute('value') || ''">
                <ui5-cb-item v-for="r in appRepos" :key="r.name" :text="r.private ? `${r.name} (private)` : r.name"
                  :value="r.name"></ui5-cb-item>
              </ui5-combobox>
              <ui5-checkbox style="margin-top: 0.75rem;" :checked="gitEditForm.enabled"
                @change="gitEditForm.enabled = ($event as any).target.checked" text="Enabled" />
            </template>

            <!-- states a & b: not installed → registration form (b adds an install-pending warning) -->
            <template v-else>
              <ui5-message-strip v-if="appInstallPending" design="Critical" hide-close-button
                style="margin-bottom: 0.75rem;">
                The GitHub App is registered but not installed on any repository yet. Finish installing it on GitHub,
                then reopen this dialog — or re-register below.
              </ui5-message-strip>
              <ui5-message-strip v-else design="Information" hide-close-button style="margin-bottom: 0.75rem;">
                Register a GitHub App to sync using short-lived installation tokens (no PAT required). You'll be
                redirected to GitHub to create and install it.
              </ui5-message-strip>

              <ui5-label>GitHub Base URL</ui5-label>
              <ui5-input :value="appGithubUrl" @input="appGithubUrl = ($event as any).target.value"
                placeholder="Leave empty for github.com, e.g. (https://)github.example.com" style="width: 100%;" />

              <ui5-label style="margin-top: 0.75rem;">Account Type</ui5-label>
              <ui5-select style="width: 100%;" @change="appAccountType = ($event as any).detail.selectedOption.value">
                <ui5-option value="user" :selected="appAccountType === 'user'">Personal account</ui5-option>
                <ui5-option value="org" :selected="appAccountType === 'org'">Organization</ui5-option>
              </ui5-select>

              <template v-if="appAccountType === 'org'">
                <ui5-label required style="margin-top: 0.75rem;">Organization</ui5-label>
                <ui5-input :value="appOrg" @input="appOrg = ($event as any).target.value" 
                    placeholder="organization name, e.g. acme-corp" style="width: 100%;" />
              </template>

              <ui5-button design="Emphasized" style="margin-top: 1rem;" :disabled="appRegistering" @click="startAppRegistration">
                {{ appInstallPending ? 'Re-register GitHub App' : 'Register GitHub App' }}
              </ui5-button>
            </template>

            <!-- Exit mechanism: available once an App is registered (installed or install-pending). -->
            <div v-if="appRegistered" class="disconnect-row">
              <ui5-button design="Negative" @click="openDisconnectDialog">Disconnect GitHub App</ui5-button>
            </div>
          </div>
        </ui5-busy-indicator>
      </template>
    </div>
    <ui5-toolbar slot="footer">
      <ui5-toolbar-button design="Emphasized" text="Save" :disabled="gitSaveDisabled" @click="onSaveGitConfig" />
      <ui5-toolbar-button design="Transparent" text="Cancel" @click="showGitEditDialog = false" />
    </ui5-toolbar>
  </ui5-dialog>

  <!-- Git Repository summary panel -->
  <ui5-panel header-text="Git Repository" fixed>
    <ui5-busy-indicator :active="gitConfigLoading" :delay="0" size="M" style="width: 100%;">
      <div class="panel-body">
        <div class="info-row">
          <div class="info-field">
            <ui5-label>Provider</ui5-label>
            <ui5-tag design="Set2" color-scheme="6" style="font-size: 0.75rem;">{{ gitConfig.provider || '—' }}</ui5-tag>
          </div>
          <div class="info-field">
            <ui5-label>Auth Method</ui5-label>
            <ui5-tag design="Set2" color-scheme="8" style="font-size: 0.75rem;">
              {{ gitConfig.authMethod === 'github_app' ? 'GitHub App' : 'PAT' }}
            </ui5-tag>
          </div>
          <div class="info-field">
            <ui5-label>Destination</ui5-label>
            <ui5-text class="mono">{{ gitConfig.destinationName || '—' }}</ui5-text>
          </div>
          <div class="info-field">
            <ui5-label>Owner / Repo</ui5-label>
            <ui5-text class="mono">{{ gitConfig.owner && gitConfig.repo ? `${gitConfig.owner}/${gitConfig.repo}` : '—' }}</ui5-text>
          </div>
          <div class="info-field">
            <ui5-label>Enabled</ui5-label>
            <ui5-tag :design="gitConfig.enabled ? 'Positive' : 'Neutral'" style="font-size: 0.75rem;">
              {{ gitConfig.enabled ? 'Yes' : 'No' }}
            </ui5-tag>
          </div>
          <div class="info-field">
            <ui5-label>Status</ui5-label>
            <ui5-tag v-if="gitTestResult" :design="statusDesign(gitTestResult.status)" style="font-size: 0.7rem;">
              {{ gitTestResult.status === 'ok' ? 'Connected' : gitTestResult.message }}
            </ui5-tag>
            <ui5-text v-else style="color: var(--sapContent_LabelColor);">—</ui5-text>
          </div>
          <div class="info-field">
            <ui5-label>&nbsp;</ui5-label>
            <div style="display: flex; gap: 0.25rem;">
              <ui5-button design="Transparent" icon="edit" @click="openGitEditDialog" tooltip="Edit" />
              <ui5-button design="Transparent" icon="connected" @click="onTestGitConnection"
                :disabled="!gitConfig.destinationName || gitTesting" tooltip="Test Connection" />
            </div>
          </div>
        </div>
      </div>
    </ui5-busy-indicator>
  </ui5-panel>
</template>

<style scoped>
.panel-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2rem;
  padding: 0.5rem 1rem;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.mono {
  font-family: var(--sapFontMonospaceFamily, monospace);
  font-size: 0.8rem;
}

.sc-dialog-content {
  display: flex;
  flex-direction: column;
}

/* App-mode content sits inside a busy-indicator whose slot would otherwise lay
   its children out inline; force the same vertical stack as .sc-dialog-content. */
.app-form {
  display: flex;
  flex-direction: column;
}

/* Exit-mechanism button sits below the App-mode content, visually separated. */
.disconnect-row {
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--sapGroup_ContentBorderColor, #e5e5e5);
  display: flex;
  justify-content: flex-start;
}

ui5-panel {
  width: 100%;
}
</style>
