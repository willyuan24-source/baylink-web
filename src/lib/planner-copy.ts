import { translateText } from '../i18n/locale';

// Translate the complete editorial statement: qualifiers and unknowns are part of the evidence.
const notices: Record<string, string> = {
  '主地点费用仍待核实；这是一份待确认的备选，不能视为整趟符合预算。': 'Costs at the main stop are still unconfirmed. This is a tentative alternative, not confirmation that the whole outing fits your budget.',
  '主地点仍在试营业，营业安排与供应可能调整，请出发前向商家确认。': 'The main stop is still in its soft opening. Hours and availability may change; check with the business before visiting.',
  '主地点按已收录营业窗口安排；这只是可编辑的访问时间，不代表已预约或保证营业。': 'The main stop uses its recorded opening window. This is an editable visit time, not a reservation or a guarantee that it will be open.',
  '这是可编辑的出游草稿。相邻站点只按同城和直线距离筛选，交通时间均为预留缓冲，不是已核实的路线或实际耗时。': 'This is an editable outing draft. Nearby stops are selected only by city and straight-line distance. Travel times are allowances, not verified routes or actual journey times.',
  '餐饮、交通与其他费用尚未填写，草稿中的 0 只是待填数值，不表示这些消费免费。': 'Meals, transport and other costs have not been entered. A 0 in the draft is a placeholder, not a claim that these expenses are free.',
  '已检查每位儿童的已公布年龄限制；各地点的亲子适宜性、成人陪同和儿童票规则仍需确认。': 'Published age limits have been checked for each child. Family suitability, adult supervision and child ticket rules still need checking at each stop.',
  '总预算缺少已确认人数，不能核实整组门票总额；暂不添加需要付费入场的地点。': 'The total budget has no confirmed party size, so admission costs for the whole group cannot be checked. Stops requiring paid admission are not added for now.',
  '主活动门票或预算仍待核实；这是一份待确认的备选，不能视为整趟符合预算。': 'Admission or the budget for the main event is still unconfirmed. This is a tentative alternative, not confirmation that the whole outing fits your budget.',
  '官方只公布主活动开始时间，暂留 90 分钟；结束时间需要向主办方确认。': 'The organizer has published only the main event’s start time. The draft allows 90 minutes; confirm the end time with the organizer.',
  '主活动开始时间选在已收录开放窗口内，是可调整的访问安排，不代表某场节目的官方开演时间。': 'The main event’s visit starts within its recorded opening window. This is an adjustable visit time, not the official start of a particular performance.',
  '主活动尚无可用的官方时段，开始与停留时间是草稿安排，请核实具体场次后使用。': 'No usable official hours are recorded for the main event. The start and duration are draft arrangements; confirm the actual session before using them.',
  '餐厅停留按已收录营业时段安排，但餐桌、预约、菜单和实际餐费未核实；请补充餐饮预算。': 'The restaurant stop uses its recorded hours, but table availability, reservations, the menu and actual meal costs have not been checked. Add a meal allowance.',
  '没有找到符合条件的餐厅；这段行程较短，未固定用餐或休息时段，用餐地点、时间与费用仍待选择。': 'No restaurant met the conditions. This short outing has no fixed meal or rest break; the meal location, time and cost still need choosing.',
  '没有找到同时满足地点、营业时间及预算条件的餐厅；已预留 45 分钟用餐，地点与餐费待选。': 'No restaurant met the location, hours and budget conditions together. A 45-minute meal break is reserved; choose the place and meal allowance.',
  '没有找到符合条件的餐厅；已预留 45 分钟休息，用餐地点、时间与费用仍待选择。': 'No restaurant met the conditions. A 45-minute rest break is reserved; the meal location, time and cost still need choosing.',
  '入场金额待确认。': 'Admission cost is unconfirmed.',
  '官方营业时间或场次尚未收录，请出发前确认。': 'Official hours or sessions are not recorded; check before visiting.',
  '先选择有效日期，再核对官方时间。': 'Choose a valid date to check official times.',
  '时间资料缺少有效来源或核对日期，目前不能确认营业。': 'The time record lacks valid source or verification information; opening is unconfirmed.',
  '所选日期不在这份时间规则的有效范围内，需重新确认。': 'This date is outside the rule’s published validity period; recheck the hours.',
  '官方时段格式存在问题，暂不据此安排；请查看来源。': 'The published time record is inconsistent; check the source before scheduling.',
  '官方场次格式存在问题，暂不据此安排；请查看来源。': 'The session record is inconsistent; check its source before scheduling.',
  '同日闭馆与场次资料互相冲突，请核实官方公告。': 'The closure and session records conflict on this date; check the official announcement.',
  '官方规则列明所选日期不开放。': 'The published rule marks this date as closed.',
  '没有所选日期的明确营业时间或场次，不能保证开放。': 'No explicit hours or sessions are recorded for this date; opening is unconfirmed.',
  '普通营业时间；节假日、包场及临时调整请出发前查看官方页面。': 'Regular opening hours. Check the official page before visiting for holidays, private events and temporary changes.',
  '普通日间门票时段；周日 10:00–12:00 仅日间会员及捐助者。周四 18 岁以上夜场另票；Tactile Dome 另需预约与购票。10/1、10/7、10/8、10/21 部分展厅有临时关闭安排，出发前查官网。': 'Regular daytime admission hours. Sunday 10:00–12:00 is for daytime members and donors only. Thursday evening admission is for ages 18+ and requires a separate ticket; the Tactile Dome requires its own reservation and ticket. Some galleries have temporary closures on 10/1, 10/7, 10/8 and 10/21; check the official site before visiting.',
  '普通展馆时段；官网此表未列周一时间。10 人及以上团体须提前预约；首个周五 18:00 后免费，其他时段依本人票种与资格购票。': 'Regular gallery hours; this official table does not list Monday hours. Groups of 10 or more require advance reservations. Admission is free after 18:00 on the first Friday; at other times, buy the ticket appropriate to your category and eligibility.',
  '仅 OMCA 展馆，不代表 Lake Merritt 湖区开放时间。普通票含特别展；首个周日免费。10/25 社区庆典有专门票种，团体与特别活动请另查预约条件。': 'These hours cover the OMCA galleries only, not the Lake Merritt area. General admission includes special exhibitions; admission is free on the first Sunday. The 10/25 community celebration has its own ticket categories. Check reservation requirements separately for groups and special events.',
  '仅普通日间入园；步道提前 30 分钟关闭，夜场另票。建议提前预约，并在所选一小时窗口内抵达。特殊日期请再查官网。': 'Regular daytime garden admission only. Trails close 30 minutes earlier; evening visits require separate tickets. Advance reservations are recommended; arrive within your selected one-hour window. Recheck the official site for special dates.',
  '试营业期间官网列周二至周六晚餐；周日、周一时间未确认。建议查看订位与当日安排。': 'During the soft opening, the official site lists dinner Tuesday through Saturday. Sunday and Monday hours are unconfirmed. Check reservations and the day’s arrangements.',
  '官网列周一至周六午、晚餐，15:00–17:00 不营业；周日时间未确认。': 'The official site lists lunch and dinner Monday through Saturday, with a closure from 15:00–17:00. Sunday hours are unconfirmed.',
  '官网确认暂时周末休息；工作日开门时间同时出现 11:00 与 12:00，尚待商家确认。': 'The official site confirms temporary weekend closures. Weekday opening is listed as both 11:00 and 12:00 and still needs confirmation from the business.',
  '美术馆咖啡餐厅营业时间，入店无需美术馆门票；特别活动营业可能调整。周一未列时间。': 'Hours for the museum’s café and restaurant; no museum ticket is needed to enter. Hours may change for special events. Monday hours are not listed.',
  '堂食最晚 15:15 点单；无需博物馆门票。周日 brunch 先到先得、不接受预约；临时及特殊活动安排另查官网。': 'Last dine-in orders are at 15:15; no museum ticket is required. Sunday brunch is first come, first served and does not take reservations. Check the official site for temporary changes and special-event arrangements.',
  '周五营业时间尚待确认；周六营业至午夜，优惠适用时段须另看具体条件。': 'Friday hours are unconfirmed. Saturday hours run until midnight; check each offer’s terms for eligible times.',
  '18 岁以上活动开放窗口；具体节目另有时间。Tactile Dome 需另行预约与购票。': 'Event opening window for ages 18+; individual programs have their own times. The Tactile Dome requires a separate reservation and ticket.',
  '市集每周二、四、六举行，风雨照常；此时间不代表 Ferry Building 内所有商家营业时间。购物与餐饮另付费。': 'The market runs every Tuesday, Thursday and Saturday, rain or shine. These are not the hours of every business inside the Ferry Building. Shopping and meals cost extra.',
  '18:00–21:00 为免费美术馆之夜；芭蕾演出所在教室 19:25 开门，座位先到先得。演出开始及结束钟点未单独公布；提前登记可加快入馆。': '18:00–21:00 is the free museum evening. The classroom hosting the ballet opens at 19:25, with seating first come, first served. The performance’s start and end times have not been separately published; advance registration can speed up museum entry.',
  '社区活动 11:00–16:00，全天免费入馆；可提前登记，也欢迎直接到场。具体节目表尚未公布。': 'The community event runs 11:00–16:00, with free museum admission all day. Advance registration and walk-ins are both welcome. The detailed program has not been published.',
  '此为周五夜整体活动窗口；音乐与展厅活动各有安排。餐饮、馆内展览及特别展的费用与时间请另查。': 'This is the overall Friday evening event window. Music and gallery activities have their own schedules. Check costs and hours separately for food, museum galleries and special exhibitions.',
  '社区庆典整体窗口；普通票 $10 含庆典与展厅，会员免费，餐饮另付费。': 'Overall community celebration window. A $10 general ticket includes the celebration and galleries; members enter free. Food and drinks cost extra.',
  '本页当前仅确认 10/2：18:30 开门、19:30 开演；结束时间未公布。其他场次须查对应票面与官方页面。': 'This page currently confirms only 10/2: doors at 18:30 and the show at 19:30. The end time has not been published. For other sessions, check the corresponding ticket and official page.',
  'Exploratorium · 日间科学探索馆': 'Exploratorium · Daytime science museum',
  'San José Museum of Art · 美术馆': 'San José Museum of Art · Galleries',
  'Oakland Museum of California · OMCA 展馆': 'Oakland Museum of California · OMCA galleries',
};

const hasChinese = (value: string) => /[\u3400-\u9fff]/.test(value);
const knownTranslation = (value: string): string | undefined => {
  if (!hasChinese(value)) return value;
  if (notices[value]) return notices[value];
  let match = value.match(/^未提供同行总人数，草稿暂按 (\d+) 人显示，请选择方案后确认人数与儿童票规则。$/);
  if (match) return `No total party size was provided. The draft currently shows ${match[1]} people; confirm the count and child ticket rules after choosing an option.`;
  match = value.match(/^每人 \$([\d.]+) 仅作为入场金额上限；未据此设置整趟总预算，餐饮与交通需要另填。$/);
  if (match) return `$${match[1]} per person is only an admission cap. It has not been set as the total outing budget; enter meals and transport separately.`;
  match = value.match(/^时间资料已超过 (\d+) 天未核对，不用于保证营业或自动安排场次。$/);
  if (match) return `These hours have not been checked in over ${match[1]} days and are not used to guarantee opening or schedule a session.`;
  const translated = translateText(value, 'en');
  return hasChinese(translated) ? undefined : translated;
};

/** Keep uncatalogued source wording visible and labelled instead of inventing or dropping a translation. */
export function plannerNoticeText(value: string, english: boolean): string {
  if (!english || !hasChinese(value)) return value;
  const translated = knownTranslation(value);
  if (translated !== undefined) return translated;
  const separator = value.indexOf('：');
  if (separator > 0) {
    const title = value.slice(0, separator);
    const body = knownTranslation(value.slice(separator + 1));
    if (body !== undefined) return `${knownTranslation(title) ?? `Original place name (Chinese): ${title}`} — ${body}`;
  }
  return `Original note (Chinese; translation unavailable): ${value}`;
}
