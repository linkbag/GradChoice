export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 prose prose-gray max-w-none">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">服务条款</h1>
        <p className="text-sm text-gray-500 mb-8">研选 GradChoice 用户服务协议</p>

        <p className="text-gray-700 mb-6">
          欢迎来到研选 GradChoice，我们知道您会想要跳过这些服务条款，但在使用研选 GradChoice
          时，了解我们的使用规则是非常必要的。
        </p>
        <p className="text-gray-700 mb-8">
          请您仔细阅读以下条款，如果您对本协议的任何条款表示异议，您可以选择不进入研选
          GradChoice。当您注册成功，无论是进入研选 GradChoice，还是在研选 GradChoice
          上发布任何内容，均意味着您（即「用户」）完全接受本协议项下的全部条款。
        </p>

        {/* 使用规则 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            使用规则
          </h2>
          <ol className="space-y-3 text-gray-700 text-sm leading-relaxed list-decimal list-outside pl-5">
            <li>
              用户注册成功后，研选 GradChoice
              将给予每个用户一个用户帐号及相应的密码，该用户帐号和密码由用户负责保管；用户应当对以其用户帐号进行的所有活动和事件负法律责任。
            </li>
            <li>
              用户须对在研选 GradChoice
              的注册信息的真实性、合法性、有效性承担全部责任，用户不得冒充他人；不得利用他人的名义发布任何信息；不得恶意使用注册帐号导致其他用户误认；否则研选
              GradChoice
              有权立即停止提供服务，收回其帐号并由用户独自承担由此而产生的一切法律责任。
            </li>
            <li>
              用户直接或通过各类方式（如 API 引用等）间接使用研选 GradChoice
              服务和数据的行为，都将被视作已无条件接受本协议全部内容；若用户对本协议的任何条款存在异议，请停止使用研选
              GradChoice 所提供的全部服务。
            </li>
            <li>
              研选 GradChoice
              是一个信息分享、传播及获取的平台，用户通过研选 GradChoice
              发表的信息为公开的信息，其他第三方均可以通过研选 GradChoice
              获取用户发表的信息，用户对任何信息的发表即认可该信息为公开的信息，并单独对此行为承担法律责任；任何用户不愿被其他第三人获知的信息都不应该在研选
              GradChoice 上进行发表。
            </li>
            <li>
              用户承诺不得以任何方式利用研选 GradChoice
              直接或间接从事违反中华人民共和国法律以及社会公德的行为，研选 GradChoice
              有权对违反上述承诺的内容予以删除。
            </li>
            <li>
              用户不得利用研选 GradChoice 服务制作、上载、复制、发布、传播或者转载如下内容：
              <ul className="mt-2 space-y-1 list-disc list-outside pl-5 text-gray-600">
                <li>反对中国宪法所确定的基本原则的；</li>
                <li>危害国家安全，泄露国家秘密，颠覆国家政权，破坏国家统一的；</li>
                <li>损害国家荣誉和利益的；</li>
                <li>煽动民族仇恨、民族歧视，破坏民族团结的；</li>
                <li>侮辱、滥用英烈形象，否定英烈事迹，美化粉饰侵略战争行为的；</li>
                <li>破坏国家宗教政策，宣扬邪教和封建迷信的；</li>
                <li>散布谣言，扰乱社会秩序，破坏社会稳定的；</li>
                <li>散布淫秽、色情、赌博、暴力、凶杀、恐怖或者教唆犯罪的；</li>
                <li>侮辱或者诽谤他人，侵害他人合法权益的；</li>
                <li>含有法律、行政法规禁止的其他内容的信息。</li>
              </ul>
            </li>
            <li>
              研选 GradChoice
              有权对用户使用研选 GradChoice 的情况进行审查和监督，如用户在使用研选 GradChoice
              时违反任何上述规定，研选 GradChoice
              或其授权的人有权要求用户改正或直接采取一切必要的措施（包括但不限于更改或删除用户张贴的内容、暂停或终止用户使用研选
              GradChoice 的权利）以减轻用户不当行为造成的影响。
            </li>
          </ol>
        </section>

        {/* 知识产权 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            知识产权
          </h2>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
            <p>
              用户在研选 GradChoice 上发表的全部原创内容，著作权均归用户本人所有。用户可授权第三方以任何方式使用。
            </p>
            <p>
              用户将其在研选 GradChoice 上发表的全部内容，授予研选 GradChoice
              免费的、不可撤销的、非独家使用许可，研选 GradChoice
              有权将该内容用于研选 GradChoice 各种形态的产品和服务上，包括但不限于网站以及发表的应用或其他互联网产品。
            </p>
            <p>
              第三方若出于非商业目的，将用户在研选 GradChoice
              上发表的内容转载在研选 GradChoice 之外的地方，应当在转载正文开头的显著位置注明原作者姓名，给出原始链接，注明「发表于研选
              GradChoice」，并不得对内容做出修改和演绎。
            </p>
            <p>
              第三方若出于商业目的，或需要对内容做出修改，则需联系作者本人获得授权。对于转载匿名内容，请联系研选
              GradChoice。
            </p>
            <p>
              对于在研选 GradChoice 上发表的内容，用户应保证其为著作权人或已取得合法授权，并且该内容不会侵犯任何第三方的合法权益。如果第三方提出关于著作权的异议，研选
              GradChoice
              有权根据实际情况删除相关的内容，且有权追究用户的法律责任。给研选 GradChoice
              或任何第三方造成损失的，用户应负责全额赔偿。
            </p>
            <p>
              研选 GradChoice
              有权但无义务对用户发布的内容进行审核，有权根据相关证据结合法律法规对侵权信息进行处理。
            </p>
          </div>
        </section>

        {/* 隐私保护 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            隐私保护
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            研选 GradChoice
            尊重并保护所有用户的个人隐私权及用户的个人资料，除法律或有法律赋予权限的政府部门要求或事先得到用户许可等原因外，研选
            GradChoice
            保证不对外公开或向第三方透露用户个人隐私信息，或用户在使用服务时存储的非公开内容。
          </p>
        </section>

        {/* 侵权举报 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            侵权举报
          </h2>
          <p className="text-gray-700 text-sm mb-4 leading-relaxed">
            研选 GradChoice 会依照法律规定删除侵权、违法信息。
          </p>

          <h3 className="font-semibold text-gray-800 mb-2 text-sm">受理范围</h3>
          <ul className="space-y-1 text-gray-700 text-sm leading-relaxed list-disc list-outside pl-5 mb-4">
            <li>
              涉及个人隐私：发布内容中直接涉及身份信息，如个人姓名、家庭住址、身份证号码、工作单位、私人电话等详细个人隐私；
            </li>
            <li>造谣、诽谤：发布内容中指名道姓（包括自然人和企业）的直接谩骂、侮辱、虚构中伤、恶意诽谤等；</li>
            <li>商业侵权：泄露企业商业机密及其他根据保密协议不能公开讨论的内容。</li>
          </ul>

          <h3 className="font-semibold text-gray-800 mb-2 text-sm">举报条件</h3>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed mb-4">
            <p>
              您可通过发送邮件到{' '}
              <a
                href="mailto:realmofresearch.contact@gmail.com"
                className="text-teal-600 hover:underline"
              >
                realmofresearch.contact@gmail.com
              </a>{' '}
              来向研选 GradChoice 进行投诉。请在邮件标题内注明「侵权举报」。
            </p>
            <p>
              为了保证问题能够及时有效地处理，请务必提交真实有效、完整清晰的材料，否则投诉将无法受理。您需要提供的投诉材料包括：
            </p>
            <ol className="space-y-2 list-decimal list-outside pl-5">
              <li>
                权利人对涉嫌侵权内容拥有著作权、商标权和/或其他依法可以行使权利的权属证明，权属证明通常是营业执照或组织机构代码证；
              </li>
              <li>举报人的身份证明，身份证明可以是身份证或护照；</li>
              <li>如果举报人非权利人，请举报人提供代表权利人进行举报的书面授权证明。</li>
              <li>
                为确保投诉材料的真实性，在侵权举报中，您还需要签署以下法律声明：
                <ul className="mt-1 space-y-1 list-disc list-outside pl-5 text-gray-600">
                  <li>我本人为所举报内容的合法权利人；</li>
                  <li>我举报的发布在研选 GradChoice 中发布的内容侵犯了本人相应的合法权益；</li>
                  <li>
                    我举报的内容完全属实。如果本侵权举报内容不完全属实，本人将承担由此产生的一切法律责任，并承担和赔偿研选
                    GradChoice
                    因根据投诉人的通知书对相关帐号的处理而造成的任何损失，包括但不限于研选
                    GradChoice 因向被投诉方赔偿而产生的损失及研选 GradChoice 名誉、商誉损害等。
                  </li>
                </ul>
              </li>
            </ol>
          </div>

          <h3 className="font-semibold text-gray-800 mb-2 text-sm">处理流程</h3>
          <p className="text-gray-700 text-sm leading-relaxed">
            研选 GradChoice
            不保证所有申请都必须受理。若申请受理，研选 GradChoice
            自收到举报的十四个工作日内处理完毕并给出回复。处理期间，不提供任何方式的查询服务。
          </p>
          <p className="text-gray-600 text-sm mt-2">
            此为研选 GradChoice 唯一的官方侵权投诉渠道，暂不提供其他方式处理此业务。
          </p>
        </section>

        {/* 免责声明 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            免责声明
          </h2>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
            <p>
              所有在研选 GradChoice
              出现的信息，包括但不限于文本、图形、链接或其它项目，均仅供参考，研选 GradChoice
              无法保证其真实性。
            </p>
            <p>
              研选 GradChoice
              上出现的第三方网站的链接及其所提供的资讯、产品及服务，研选 GradChoice
              概不负责，亦不负任何法律责任。
            </p>
            <p>
              用户在研选 GradChoice 发布的言论仅代表其个人意见和观点，并不代表研选 GradChoice
              的立场或观点。
            </p>
            <p>
              用户因其使用研选 GradChoice 产生的一切后果由其自己承担，研选 GradChoice
              不承担任何法律及连带责任。
            </p>
            <p>
              研选 GradChoice
              不保证网络服务一定能满足用户的要求，也不保证网络服务不会中断，对网络服务的及时性、安全性、准确性也都不作保证。对于因不可抗力或研选
              GradChoice
              不能控制的原因造成的网络服务中断或其它缺陷，研选 GradChoice
              不承担任何责任，但研选 GradChoice 将尽力减少因此而给用户造成的损失和影响。
            </p>
          </div>
        </section>

        {/* 协议修改 */}
        <section className="mb-4">
          <h2 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            协议修改
          </h2>
          <p className="text-gray-700 text-sm leading-relaxed">
            根据互联网的发展和有关法律、法规及规范性文件的变化，或者因业务发展需要，研选
            GradChoice
            有权对本协议的条款作出修改或变更，一旦本协议的内容发生变动，研选 GradChoice
            将会直接在研选 GradChoice
            网站上公布修改之后的协议内容，该公布行为视为研选 GradChoice
            已经通知用户修改内容。研选 GradChoice
            也可采用电子邮件的传送方式，提示用户协议条款的修改、服务变更、或其它重要事项。
          </p>
          <p className="text-gray-700 text-sm leading-relaxed mt-3">
            如果不同意研选 GradChoice
            对本协议相关条款所做的修改，用户有权并应当停止使用研选 GradChoice。如果用户继续使用研选
            GradChoice，则视为用户接受研选 GradChoice 对本协议相关条款所做的修改。
          </p>
        </section>
      </div>
    </div>
  )
}
