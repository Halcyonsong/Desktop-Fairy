<script setup lang="ts">
import { ref, watch } from 'vue';

type HelpSection = 'chat' | 'provider' | 'fairy' | 'system';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const helpSection = ref<HelpSection>('chat');

watch(
  () => props.open,
  (open) => {
    if (open) {
      helpSection.value = 'chat';
    }
  },
);
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="open" class="session-modal-overlay" @click.self="emit('close')">
      <div class="session-help-dialog" role="dialog" aria-modal="true">
        <div class="session-help-dialog__header">
          <div>
            <p class="session-help-dialog__eyebrow">帮助中心</p>
            <h3 class="session-help-dialog__title">基础功能说明</h3>
          </div>
          <button type="button" class="session-help-dialog__close" aria-label="关闭帮助说明" @click="emit('close')">×</button>
        </div>

        <div class="session-help-dialog__layout">
          <aside class="session-help-dialog__nav">
            <button type="button" class="session-help-dialog__nav-item" :class="{ 'session-help-dialog__nav-item--active': helpSection === 'chat' }" @click="helpSection = 'chat'">对话</button>
            <button type="button" class="session-help-dialog__nav-item" :class="{ 'session-help-dialog__nav-item--active': helpSection === 'provider' }" @click="helpSection = 'provider'">供应商配置</button>
            <button type="button" class="session-help-dialog__nav-item" :class="{ 'session-help-dialog__nav-item--active': helpSection === 'fairy' }" @click="helpSection = 'fairy'">桌面精灵</button>
            <button type="button" class="session-help-dialog__nav-item" :class="{ 'session-help-dialog__nav-item--active': helpSection === 'system' }" @click="helpSection = 'system'">系统操作</button>
          </aside>

          <div class="session-help-dialog__content">
            <template v-if="helpSection === 'chat'">
              <div class="session-help-card session-help-card--rich">
                <h4>对话模块</h4>
                <p class="session-help-card__intro">这里主要用于日常聊天、连续追问、历史查看和消息整理。若要正常开始普通对话，前提是已经完成模型配置并选中可用模型。</p>

                <div class="session-help-topic">
                  <h5>发送</h5>
                  <ul>
                    <li>普通对话下，空消息不会发送。</li>
                    <li>发送前需要先配置并选中可用模型，否则无法正常对话。</li>
                    <li>发送后会进入生成状态，可继续观察回复、思考过程和后续操作。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>打断</h5>
                  <ul>
                    <li>生成过程中可手动打断。</li>
                    <li>已生成出来的内容仍会保留，并会计入记忆。</li>
                    <li>适合在答案已经够用，或你想尽快切换到下一轮提问时使用。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>删除</h5>
                  <ul>
                    <li>删除后，这条消息会从界面中移除。</li>
                    <li>对应的单条记忆也会一并删除。</li>
                    <li>适合清理不需要保留的内容或错误记录。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>撤回</h5>
                  <ul>
                    <li>撤回会删除该轮内容，并把输入恢复到可重新编辑状态。</li>
                    <li>适合你想微调原问题、重发更精确版本时使用。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>语音输入</h5>
                  <ul>
                    <li>语音输入首次使用前需要先下载语音相关资源。</li>
                    <li>下载完成后可直接转成输入内容，再继续编辑或发送。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>历史记录</h5>
                  <ul>
                    <li>消息列表上拉到顶部后，可以继续加载更多历史内容。</li>
                    <li>当聊天较长时，可使用快速回到底部功能，迅速回到最新消息位置。</li>
                    <li>左侧会话列表也支持搜索、切换、重命名和删除会话。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>模型参数与系统提示词</h5>
                  <ul>
                    <li>温度和最大 Token 可在对话栏与参数配置中调整。</li>
                    <li>温度越高，回复通常越发散、更有随机性；温度越低，回复通常更稳定、更收敛。</li>
                    <li>最大 Token 会影响单次回复允许生成的长度上限。</li>
                    <li>如果不手动改动，默认会使用模型官方推荐默认值。</li>
                    <li>你也可以在设置里的参数配置中填写系统提示词，保存后会全局生效。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>补充说明</h5>
                  <ul>
                    <li>临时闲聊入口可与主工作台会话并行使用。</li>
                    <li>桌面精灵相关的陪伴、动作和临时闲聊联动，这里只做简要说明，详细可切到“桌面精灵”栏目查看。</li>
                  </ul>
                </div>
              </div>
            </template>

            <template v-else-if="helpSection === 'provider'">
              <div class="session-help-card session-help-card--rich">
                <h4>供应商配置</h4>
                <p class="session-help-card__intro">这里用于配置模型供应商、接口地址、密钥、模型名称以及本地脚本能力。大多数配置改动都需要保存后才会真正生效。</p>

                <div class="session-help-topic">
                  <h5>URL / 请求路径</h5>
                  <ul>
                    <li>请求路径按 OpenAI 兼容接口方式使用。</li>
                    <li>请填写实际可访问、格式正确的接口地址。</li>
                    <li>如果地址错误、缺少路径或协议不对，通常会导致模型请求失败。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>API Key / 密钥</h5>
                  <ul>
                    <li>密钥需要有效配置，且应与当前接口地址对应。</li>
                    <li>密钥错误、失效或权限不足时，模型通常无法正常调用。</li>
                    <li>如果是本地模型并走 OpenAI 兼容接口，API Key 可自行填写，建议统一写成“local”。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>模型</h5>
                  <ul>
                    <li>模型可以通过按钮从上游拉取，也可以手动填写。</li>
                    <li>模型名必须真实存在且填写正确，否则无法正常使用。</li>
                    <li>如果你明确知道上游模型名，手动填写通常会更直接。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>名称与 Provider</h5>
                  <ul>
                    <li>名称和 Provider 主要用于标识与区分配置项。</li>
                    <li>它们本身不会直接影响模型实际调用效果。</li>
                    <li>建议填写成你自己容易识别的名称，方便后续维护。</li>
                    <li>如果某个已配置供应商下的模型被全部删除，那么退出时会自动删除这条供应商配置。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>保存与生效</h5>
                  <ul>
                    <li>新增模型、修改请求路径、修改 API Key 等改动后，必须保存才能生效。</li>
                    <li>如果只改了内容但没有保存，聊天区仍可能继续使用旧配置。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>刷新配置</h5>
                  <ul>
                    <li>添加或修改供应商配置后，客户端有时不会立刻反应。</li>
                    <li>这时可以点击刷新按钮，重新从已保存的数据中获取配置。</li>
                    <li>刷新更像是“重新读取当前保存结果”，不是自动保存。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>脚本安装</h5>
                  <ul>
                    <li>脚本能力需要本机具备 Python 环境。</li>
                    <li>安装时会自动下载若干依赖和一个测试模型。</li>
                    <li>测试模型体积较轻，主要用于验证能力，不代表效果很强，也可能较难带动桌面精灵场景。</li>
                    <li>安装完成后，脚本会尝试自动把相关内容补到供应商配置中。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>安装异常与补录</h5>
                  <ul>
                    <li>有时最后一步可能异常：模型已经下好了，但没有自动添加到供应商配置。</li>
                    <li>这时可以再次点击安装。</li>
                    <li>如果脚本检测到模型已存在，会跳过重复下载，并尝试自动补充供应商配置。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>启动 / 停止脚本</h5>
                  <ul>
                    <li>启动脚本用于拉起本地相关服务或测试能力。</li>
                    <li>停止脚本用于关闭对应脚本进程，避免重复占用资源。</li>
                    <li>如遇脚本无响应、端口占用或重复运行，通常可先停止再重新启动。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>脚本日志</h5>
                  <ul>
                    <li>脚本日志可用于查看安装、启动、停止和运行过程中的实际输出。</li>
                    <li>如果配置没生效、模型没拉到、服务没启动起来，优先先看日志。</li>
                  </ul>
                </div>
              </div>
            </template>

            <template v-else-if="helpSection === 'fairy'">
              <div class="session-help-card session-help-card--rich">
                <h4>桌面精灵</h4>
                <p class="session-help-card__intro">桌面精灵是一个悬浮在桌面的交互入口，整体能力基本继承工作台对话功能，但更偏陪伴、快速聊天和轻量交互。</p>

                <div class="session-help-topic">
                  <h5>开启效果</h5>
                  <ul>
                    <li>开启后，精灵会以悬浮窗形式显示，并保持在桌面较上层的位置。</li>
                    <li>适合边使用电脑边快速查看、切换和发起对话。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>自动闲聊</h5>
                  <ul>
                    <li>开启自动闲聊后，精灵会在满足条件时主动发起闲聊互动。</li>
                    <li>这会带来额外的模型调用和 token 开销，建议按需开启。</li>
                    <li>你可以设置闲聊触发时间，控制它多久触发一次。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>会话与临时闲聊</h5>
                  <ul>
                    <li>精灵可选择已有会话，也可以进入临时闲聊。</li>
                    <li>临时闲聊不会长期持久化，只适合临时互动使用，并带有效期概念。</li>
                    <li>如果你想做长期稳定的人设或持续对话，建议通过系统提示词配置后，在普通对话中使用。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>交互注意点</h5>
                  <ul>
                    <li>精灵处进行会话选择或发送时，需要确认鼠标图标已经变成小手图标，再点击才会生效。</li>
                    <li>如果没有变成可交互状态，当前点击可能不会被精灵区域接收。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>可调参数</h5>
                  <ul>
                    <li>可以设置闲聊触发时间。</li>
                    <li>可以调整角色显示大小。</li>
                    <li>也可以结合桌面行为、显示方式等配置一起微调使用体验。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>补充说明</h5>
                  <ul>
                    <li>精灵在能力上大体继承工作台对话功能，所以模型配置、系统提示词等基础能力同样会影响精灵表现。</li>
                    <li>如果你发现精灵对话异常，优先检查模型配置、会话选择和自动闲聊开关。</li>
                  </ul>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="session-help-card session-help-card--rich">
                <h4>系统操作</h4>

                <div class="session-help-topic">
                  <h5>重载界面</h5>
                  <ul>
                    <li>重载界面会重新加载当前工作台窗口。</li>
                    <li>适合在界面未及时刷新、状态显示异常或刚完成某些配置后使用。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>日志查看</h5>
                  <ul>
                    <li>日志页可查看前端运行日志与后端日志输出。</li>
                    <li>如果模型调用失败、脚本未启动、配置未生效，建议优先先看日志内容。</li>
                  </ul>
                </div>

                <div class="session-help-topic">
                  <h5>文件路径</h5>
                  <ul>
                    <li>文件路径页用于说明数据库、日志、语音模型缓存、精灵状态等数据的实际存放位置。</li>
                    <li>在需要备份、排查或手动定位文件时，可优先查看这里。</li>
                  </ul>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.session-help-dialog {
  width: min(1040px, calc(100vw - 56px));
  max-height: min(86vh, 860px);
  overflow: auto;
  border-radius: 24px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(15, 23, 42, 0.97);
  box-shadow: 0 28px 64px rgba(15, 23, 42, 0.35);
  color: rgba(241, 245, 249, 0.96);
  padding: 1.35rem 1.35rem 1.2rem;
}

.session-help-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.session-help-dialog__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.9);
}

.session-help-dialog__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}

.session-help-dialog__close {
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 999px;
  background: rgba(51, 65, 85, 0.9);
  color: rgba(241, 245, 249, 0.96);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.session-help-dialog__layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 1rem;
}

.session-help-dialog__nav {
  display: grid;
  gap: 0.45rem;
  align-content: start;
}

.session-help-dialog__nav-item {
  width: 100%;
  text-align: left;
  padding: 0.75rem 0.85rem;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(30, 41, 59, 0.68);
  color: rgba(226, 232, 240, 0.95);
  cursor: pointer;
}

.session-help-dialog__nav-item--active {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(96, 165, 250, 0.35);
  color: rgba(255, 255, 255, 0.98);
}

.session-help-dialog__content {
  min-width: 0;
}

.session-help-card {
  padding: 1rem 1.05rem;
  border-radius: 18px;
  background: rgba(30, 41, 59, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.session-help-card--rich {
  display: grid;
  gap: 1rem;
}

.session-help-card__intro {
  margin: 0;
  color: rgba(226, 232, 240, 0.9);
  line-height: 1.7;
}

.session-help-topic {
  display: grid;
  gap: 0.45rem;
}

.session-help-topic h5 {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.98);
}

.session-help-card h4 {
  margin: 0 0 0.6rem;
  font-size: 0.98rem;
}

.session-help-card ul {
  margin: 0;
  padding-left: 1rem;
  display: grid;
  gap: 0.45rem;
  font-size: 0.9rem;
  line-height: 1.6;
}

@media (max-width: 720px) {
  .session-help-dialog {
    width: min(94vw, 1040px);
    padding: 1rem;
  }

  .session-help-dialog__layout {
    grid-template-columns: 1fr;
  }

  .session-help-dialog__nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .session-help-dialog__nav {
    grid-template-columns: 1fr;
  }
}
</style>
