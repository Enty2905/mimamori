"""18+ risk-specific, TTS-friendly Vietnamese deterministic safety response templates.

Invariants for EVERY template:
- Plain Vietnamese text: 0 Markdown, 0 Emoji, 0 English jargon.
- 2 to 4 short, clear sentences (<= 92 words) optimized for Vietnamese TTS (0.8x-0.9x).
- Always uses respectful 'cháu' + resolved honorific ('cụ'/'ông'/'bà'/'bác'/'ông/bà').
- Zero false capability claims (never claims AI called 115, dialed family, or updated DB).
- Zero false reassurance, zero watchful-waiting delay, zero unnegated unsafe first aid.
"""

from __future__ import annotations

from typing import Optional

from app.safety._normalizer import capitalize_honorific


def build_emergency_response(
    honorific: str,
    matched_labels: list[str],
    *,
    sub_type: str = "default",
) -> tuple[str, str]:
    """Return risk-specific deterministic emergency reply and escalation guidance."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)

    if sub_type == "chest_pain":
        reply = (
            f"Dạ {h}, cháu rất lo vì đây là dấu hiệu đau tức ngực nguy hiểm, tuyệt đối không chờ đợi, "
            f"không giơ tay trái lên và không tự theo dõi thêm ạ. "
            f"{H} hãy ngừng mọi hoạt động ngay, ngồi hoặc nằm nghỉ yên tại chỗ và nhờ người thân hoặc "
            f"người ở gần gọi cấp cứu 115 lập tức. "
            f"Cháu không thể tự gọi điện thay, nên {h} hãy báo ngay cho người nhà hỗ trợ nhé."
        )
        escalation = (
            "Gọi ngay cấp cứu 115 và báo người thân hoặc người ở gần lập tức. "
            "Ngừng di chuyển, tuyệt đối không chờ đợi và không áp dụng mẹo giơ tay trái."
        )
        return reply, escalation

    if sub_type == "stroke":
        reply = (
            f"Dạ {h}, các biểu hiện tê mặt, méo miệng, nói khó hay yếu liệt tay chân là dấu hiệu khẩn cấp ạ. "
            f"Xin {h} ngồi hoặc nằm yên an toàn, tuyệt đối không chích máu đầu ngón tay, không cạo gió, "
            f"không bấm huyệt và không tự ăn uống hay dùng thuốc. "
            f"Cháu không thể tự gọi điện thay, nên xin nhờ người thân hoặc người ở gần gọi cấp cứu 115 "
            f"ngay lập tức và nhớ giờ bắt đầu triệu chứng để báo bác sĩ nhé."
        )
        escalation = (
            "Gọi ngay cấp cứu 115 và báo người thân lập tức. "
            "Ghi nhớ giờ khởi phát, không chích máu, không cạo gió và không trì hoãn."
        )
        return reply, escalation

    if sub_type == "choking":
        reply = (
            f"Dạ {h}, tình trạng hóc nghẹn kèm thở rít hoặc tím tái là cấp cứu đe dọa tính mạng ạ. "
            f"Xin hô ngay người thân hoặc người ở gần gọi cấp cứu 115 lập tức và hỗ trợ sơ cứu đúng cách, "
            f"tuyệt đối không nuốt cơm, không uống nhiều nước và không móc họng mù vì rất nguy hiểm. "
            f"Cháu không thể tự gọi điện thay nên cần người bên cạnh giúp ngay nhé."
        )
        escalation = (
            "Gọi cấp cứu 115 và hô hoán người ở gần ứng cứu ngay lập tức. "
            "Tuyệt đối không nuốt cơm, không uống nước hay móc họng mù."
        )
        return reply, escalation

    if sub_type == "hypoglycemia":
        reply = (
            f"Dạ {h}, run lẩy bẩy, vã mồ hôi lạnh kèm hoa mắt, nói lắp bắp muốn lả đi sau tiêm tiểu đường "
            f"là tình huống rất khẩn cấp ạ. "
            f"Xin {h} ngồi yên, tuyệt đối không tiêm hay uống thêm thuốc tiểu đường, không tự đi lại một mình, "
            f"và không ép đổ nước hay thức ăn nếu đang lơ mơ khó nuốt. "
            f"Cháu không thể tự gọi điện thay, nên xin nhờ người thân ở cạnh gọi cấp cứu 115 ngay lập tức nhé."
        )
        escalation = (
            "Báo người thân ở cạnh và gọi cấp cứu 115 ngay lập tức. "
            "Không dùng thêm thuốc tiểu đường và không ép uống khi đang lơ mơ."
        )
        return reply, escalation

    if sub_type == "anaphylaxis":
        reply = (
            f"Dạ {h}, sưng môi, sưng mí mắt, nghẹn họng kèm khó thở khò khè sau khi uống thuốc "
            f"là dấu hiệu cực kỳ khẩn cấp ạ. "
            f"Xin {h} ngừng uống thêm thuốc ngay, giữ tư thế ngồi hoặc nằm đầu cao cho dễ thở và "
            f"không tự uống thêm thuốc chống dị ứng ở nhà. "
            f"Cháu không thể tự gọi điện thay, nên xin nhờ người thân ở gần gọi cấp cứu 115 ngay lập tức nhé."
        )
        escalation = (
            "Ngừng uống thêm thuốc ngay, giữ tư thế đầu cao dễ thở, báo người thân và gọi cấp cứu 115 lập tức."
        )
        return reply, escalation

    if sub_type == "gi_bleeding":
        reply = (
            f"Dạ {h}, nôn ra máu hoặc đi ngoài phân đen kèm choáng lạnh là dấu hiệu xuất huyết rất nguy hiểm ạ. "
            f"Xin {h} nằm nghỉ yên, nghiêng đầu sang một bên để tránh sặc, tuyệt đối không ăn uống hay "
            f"uống thêm thuốc gì và không tự đứng dậy đi lại. "
            f"Cháu không thể tự gọi điện thay, nên xin nhờ người thân gọi cấp cứu 115 ngay lập tức nhé."
        )
        escalation = (
            "Gọi ngay cấp cứu 115 và báo người thân lập tức. "
            "Nằm yên nghiêng đầu phòng sặc, tạm nhịn ăn uống và không tự di chuyển."
        )
        return reply, escalation

    if sub_type == "heatstroke":
        reply = (
            f"Dạ {h}, cháu rất lo vì sốt nóng ran, đau đầu dữ dội kèm lơ mơ lẫn lộn sau khi đi nắng là cấp cứu rất nguy hiểm ạ. "
            f"Xin nhờ người thân đưa ngay vào chỗ râm mát thoáng khí, nới lỏng quần áo, lau mát cơ thể và "
            f"gọi cấp cứu 115 ngay lập tức. "
            f"Tuyệt đối không ép đổ nước, không tự ý cho uống thuốc hạ sốt khi đang lơ mơ và không cạo gió nhé."
        )
        escalation = (
            "Đưa vào nơi râm mát, lau mát, báo người thân và gọi cấp cứu 115 ngay lập tức. "
            "Không đổ nước hay cho uống thuốc khi đang lơ mơ."
        )
        return reply, escalation

    if sub_type == "scald_burn":
        reply = (
            f"Dạ {h}, bỏng nước sôi diện rộng có phồng rộp bong tróc da cần được cấp cứu y tế ngay ạ. "
            f"Xin {h} xả nhẹ nước mát sạch lên vùng bỏng trong 15 đến 20 phút, che phủ nhẹ bằng gạc sạch, "
            f"tuyệt đối không bôi kem đánh răng, không bôi nước mắm, không chườm đá lạnh và không chọc vỡ bọng nước. "
            f"Cháu không thể tự gọi điện thay, nên {h} hãy báo người thân gọi cấp cứu 115 hoặc đưa đi viện ngay nhé."
        )
        escalation = (
            "Xả nhẹ nước mát sạch, báo người thân và gọi cấp cứu 115 hoặc đưa đi viện ngay. "
            "Không bôi kem đánh răng, nước mắm hay chọc vỡ bọng nước."
        )
        return reply, escalation

    if sub_type == "severe_asthma":
        reply = (
            f"Dạ {h}, cơn khó thở nặng co kéo, không nói trọn câu hoặc tím móng tay là cấp cứu khẩn cấp ạ. "
            f"Xin {h} giữ tư thế ngồi tựa hơi cúi nhẹ về trước cho dễ thở, tuyệt đối không nằm ngửa phẳng "
            f"và không gắng sức đi lại. "
            f"Cháu không thể tự gọi điện thay, nên {h} hãy báo người thân ở gần gọi cấp cứu 115 ngay lập tức nhé."
        )
        escalation = (
            "Giữ tư thế ngồi tựa hơi nghiêng về trước, không nằm ngửa phẳng, báo người thân và gọi cấp cứu 115 ngay lập tức."
        )
        return reply, escalation

    if sub_type == "acute_vision_loss":
        reply = (
            f"Dạ {h}, mất thị lực đột ngột một bên mắt kèm đau buốt đầu dữ dội là cấp cứu rất khẩn cấp ạ. "
            f"Xin {h} ngồi nghỉ yên, tuyệt đối không dụi mắt, không ấn vào mắt, không tự nhỏ thuốc nhỏ mắt "
            f"và không tự lái xe. "
            f"Cháu không thể tự gọi điện thay, nên xin nhờ người thân gọi cấp cứu 115 ngay và ghi nhớ giờ bắt đầu triệu chứng nhé."
        )
        escalation = (
            "Gọi cấp cứu 115 và báo người thân ngay lập tức. "
            "Không dụi mắt, không nhỏ thuốc tự ý, không tự lái xe và ghi nhớ giờ khởi phát."
        )
        return reply, escalation

    symptoms_text = ", ".join(matched_labels) if matched_labels else "dấu hiệu nguy hiểm"
    reply = (
        f"Dạ {h}, cháu rất lo vì {h} đang có dấu hiệu {symptoms_text} rất nguy hiểm cần cấp cứu ngay ạ. "
        f"Xin {h} ngừng di chuyển, giữ tư thế ngồi hoặc nằm yên an toàn, không tự đứng dậy và không chờ đợi thêm. "
        f"Cháu không thể tự gọi điện thay, nên {h} hãy báo ngay cho người thân hoặc người ở gần gọi cấp cứu 115 lập tức nhé."
    )
    escalation = (
        "Gọi ngay cấp cứu 115 và thông báo lập tức cho người thân hoặc người chăm sóc. "
        "Không tự di chuyển, không tự lái xe và không chờ đợi triệu chứng tự qua."
    )
    return reply, escalation


def build_toxic_poison_response(honorific: str) -> tuple[str, str]:
    """Template 2: Lethal herbal poison refusal (mã tiền / phụ tử / lá ngón — ph-om-004)."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu tuyệt đối không thể hướng dẫn công thức hay số gam ngâm rượu mã tiền, phụ tử "
        f"vì đây là dược liệu kịch độc chứa độc chất gây ngộ độc cấp, co giật, loạn nhịp tim và tử vong ạ. "
        f"Nếu {h} hoặc ai trong nhà đã lỡ uống rượu ngâm này, xin gọi cấp cứu 115 hoặc đưa đến bệnh viện "
        f"ngay lập tức mà không chờ xuất hiện triệu chứng. "
        f"Để an toàn cho sức khỏe, {h} hãy đi khám bác sĩ chuyên khoa để được điều trị đúng cách nhé."
    )
    escalation = (
        "Tuyệt đối không pha chế hay uống mã tiền, phụ tử. "
        "Nếu đã lỡ uống, gọi ngay cấp cứu 115 hoặc đến bệnh viện lập tức."
    )
    return reply, escalation


def build_self_harm_crisis_response(honorific: str) -> tuple[str, str]:
    """Template 3: Empathetic self-harm screening and crisis safety plan (ph-es-009)."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu lắng nghe thấy {h} đang rất mệt mỏi và nặng nề, cháu thật lòng lo lắng cho sự an toàn của {h} ạ. "
        f"Cháu xin phép hỏi nhẹ nhàng là lúc này {h} có đang có ý nghĩ tự làm hại bản thân không ạ? "
        f"Xin {h} không ở một mình lúc này; cháu không thể tự gọi điện thay nên {h} hãy báo ngay cho "
        f"người thân tin cậy ở gần và gọi cấp cứu 115 ngay lập tức nếu cảm thấy không an toàn nhé."
    )
    escalation = (
        "Không ở một mình, liên hệ ngay người thân hoặc người đáng tin cậy ở gần, "
        "và gọi cấp cứu 115 ngay lập tức nếu có ý định hoặc nguy cơ tự gây hại."
    )
    return reply, escalation


def build_new_medication_adr_response(honorific: str) -> tuple[str, str]:
    """Template 4: Neutral new-medication ADR response satisfying all 6 ph-ms-009 criteria."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu không thể kết luận triệu chứng mẩn ngứa hay buồn nôn này có phải dị ứng thuốc hay không, "
        f"và cháu cũng không được tự quyết định việc {h} tiếp tục uống hay ngừng bỏ liều thuốc tiếp theo ạ. "
        f"{H} hãy báo cho người thân và liên hệ sớm với bác sĩ kê đơn hoặc dược sĩ trước giờ uống liều chiều "
        f"để được hướng dẫn, đồng thời không tự dùng thêm thuốc chống dị ứng nào khác. "
        f"Nếu có khó thở, sưng môi, sưng lưỡi, sưng mặt hoặc choáng ngất, hãy nhờ người ở gần gọi cấp cứu 115 ngay lập tức nhé."
    )
    escalation = (
        "Báo người thân và liên hệ sớm bác sĩ kê đơn hoặc dược sĩ trước liều tiếp theo. "
        "Gọi ngay cấp cứu 115 nếu xuất hiện khó thở, sưng môi, sưng lưỡi, sưng mặt hoặc choáng ngất."
    )
    return reply, escalation


def build_missed_dose_response(honorific: str) -> tuple[str, str]:
    """Template 5: Missed/uncertain dose & app-log limit guidance (ph-ms-002, ph-ms-003)."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu không được phép khuyên uống bù hay gộp liều thay bác sĩ, và {h} tuyệt đối "
        f"không tự ý uống thêm hay uống gấp đôi liều vì dễ gây tụt huyết áp hoặc hạ đường huyết nguy hiểm ạ. "
        f"Trạng thái trên ứng dụng chỉ phản ánh thao tác bấm xác nhận chứ không phải bằng chứng chắc chắn tuyệt đối "
        f"đã uống ngoài thực tế. "
        f"{H} hãy kiểm tra lại vỉ thuốc, hộp chia thuốc, hỏi người thân và liên hệ bác sĩ hoặc dược sĩ trước khi uống nhé."
    )
    escalation = (
        "Không tự ý uống bù hay gộp liều. Kiểm tra vỉ thuốc, hộp chia thuốc, hỏi người thân và tham vấn bác sĩ hoặc dược sĩ."
    )
    return reply, escalation


def build_tablet_crushing_response(honorific: str) -> tuple[str, str]:
    """Template 6: Tablet crushing guidance distinguishing coated vs extended-release (ph-ms-006)."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu khuyên {h} không nên tự ý giã nát hay bẻ đôi viên thuốc khi chưa hỏi ý kiến chuyên môn ạ. "
        f"Viên bao đường hay bao phim giúp che vị đắng và bảo vệ dạ dày, còn viên giải phóng kéo dài kiểm soát tốc độ "
        f"thả thuốc từ từ nên khi nghiền nát sẽ giải phóng cả lượng thuốc cùng lúc gây nguy cơ quá liều cấp. "
        f"{H} hãy hỏi bác sĩ hoặc dược sĩ để kiểm tra đúng dạng thuốc và tìm cách dùng dễ nuốt hơn nhé."
    )
    escalation = (
        "Không tự giã nát hay bẻ viên thuốc. Hỏi trực tiếp bác sĩ hoặc dược sĩ về dạng bào chế phù hợp."
    )
    return reply, escalation


def build_unidentified_pill_response(
    honorific: str,
    *,
    fragmented_stt: bool = False,
) -> tuple[str, str]:
    """Template 7: Unidentified pill / unmarked blister / fragmented STT query."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    if fragmented_stt:
        reply = (
            f"Dạ {h}, cháu nghe câu hỏi bị ngắt quãng nên chưa rõ {h} đang hỏi về hộp thuốc nào trên bàn, "
            f"nên cháu không thể tự đoán tên thuốc hay số viên cần uống ạ. "
            f"{H} vui lòng nói lại rõ hơn hoặc nhờ người thân ở gần đọc trực tiếp nhãn hộp và đơn thuốc gốc, "
            f"hoặc hỏi dược sĩ và bác sĩ để dùng thuốc thật an toàn nhé."
        )
        escalation = (
            "Không tự đoán tên thuốc hoặc số viên. Nhờ người thân đọc trực tiếp nhãn hộp và đơn thuốc hoặc hỏi dược sĩ."
        )
        return reply, escalation

    reply = (
        f"Dạ {h}, cháu không thể nhận diện tên thuốc, công dụng điều trị hay thời điểm uống chỉ dựa vào "
        f"màu sắc, hình dáng hoặc vỉ thuốc đã mất chữ vì rất dễ nhầm thuốc nguy hiểm ạ. "
        f"Xin {h} tạm để riêng và tuyệt đối không vội uống viên hay mảnh vỉ thuốc đó. "
        f"{H} hãy nhờ người thân, dược sĩ hoặc bác sĩ đối chiếu trực tiếp với vỏ hộp và đơn thuốc gốc cho an tâm nhé."
    )
    escalation = (
        "Không uống viên thuốc rời hoặc vỉ thuốc mất nhãn. Nhờ người thân, dược sĩ hoặc bác sĩ đối chiếu đơn thuốc gốc."
    )
    return reply, escalation


def build_diagnosis_refusal_response(
    honorific: str,
    *,
    variant: str = "default",
) -> tuple[str, str]:
    """Template 8a: Non-diagnostic / specialist procedure refusal."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)

    if variant == "specialist_override":
        reply = (
            f"Dạ {h}, cháu hiểu {h} đang lo lắng trước thủ thuật, nhưng cháu không thể phán quyết hay "
            f"thay đổi chỉ định điều trị của bác sĩ chuyên khoa ạ. "
            f"Thuốc bổ tim không thể thay thế chức năng của thiết bị hỗ trợ nhịp tim hay chỉ định phẫu thuật khi bác sĩ đã cân nhắc. "
            f"{H} hãy cùng người thân trao đổi thẳng thắn mọi băn khoăn trực tiếp với bác sĩ tim mạch để an tâm hơn nhé."
        )
        escalation = "Trao đổi trực tiếp cùng người thân với bác sĩ chuyên khoa, không tự ý bỏ chỉ định điều trị."
        return reply, escalation

    if variant == "thyroid_imaging":
        reply = (
            f"Dạ {h}, cháu không thể kết luận nhân tuyến giáp là u lành hay ung thư và cũng không thể "
            f"quyết định chỉ định mổ thay bác sĩ ạ. "
            f"Thang điểm TIRADS trên siêu âm chỉ là phân loại hình ảnh giúp bác sĩ đánh giá mức độ cần theo dõi "
            f"hoặc làm thêm xét nghiệm chuyên sâu. "
            f"{H} hãy mang phiếu siêu âm đi khám trực tiếp bác sĩ chuyên khoa cùng người thân để được tư vấn chính xác nhé."
        )
        escalation = "Mang phiếu siêu âm gặp trực tiếp bác sĩ chuyên khoa nội tiết hoặc ung bướu để được đánh giá."
        return reply, escalation

    reply = (
        f"Dạ {h}, cháu không thể chẩn đoán bệnh hay kết luận nguyên nhân triệu chứng thay cho bác sĩ ạ. "
        f"Để an toàn và chính xác nhất, {h} nên trao đổi với người thân và đi khám trực tiếp bác sĩ chuyên khoa "
        f"hoặc cơ sở y tế để được thăm khám đầy đủ nhé."
    )
    escalation = "Tham khảo bác sĩ hoặc cơ sở y tế để được thăm khám, đồng thời báo cho người thân theo dõi."
    return reply, escalation


def build_dosage_refusal_response(
    honorific: str,
    *,
    variant: str = "default",
) -> tuple[str, str]:
    """Template 8b: Anti-prescribing and dosage modification refusal with specialized variants."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)

    if variant == "expired":
        reply = (
            f"Dạ {h}, cháu khuyên {h} tuyệt đối không dùng thuốc đã quá hạn sử dụng dù bề ngoài viên thuốc chưa mốc "
            f"hay chưa đổi màu ạ. "
            f"Thuốc quá hạn có thể mất tác dụng hoặc biến chất gây hại cho sức khỏe. "
            f"{H} hãy bỏ thuốc quá hạn đúng cách, nhờ người thân kiểm tra lại tủ thuốc và hỏi bác sĩ hoặc dược sĩ nếu cần đơn mới nhé."
        )
        escalation = "Không dùng thuốc quá hạn, bỏ thuốc quá hạn đúng cách và tham vấn bác sĩ hoặc dược sĩ."
        return reply, escalation

    if variant == "sharing":
        reply = (
            f"Dạ {h}, cháu khuyên {h} tuyệt đối không uống thuốc kê đơn riêng của người khác, đặc biệt là thuốc an thần "
            f"vì ở người cao tuổi rất dễ gây chóng mặt, lú lẫn và té ngã nguy hiểm ạ. "
            f"Mỗi đơn thuốc được bác sĩ kê theo thể trạng riêng của từng người. "
            f"{H} hãy trao đổi với người thân và đi khám bác sĩ để được tư vấn cách cải thiện giấc ngủ an toàn nhé."
        )
        escalation = "Không dùng chung thuốc kê đơn của người khác. Đi khám bác sĩ để được tư vấn phù hợp."
        return reply, escalation

    if variant == "alcohol":
        reply = (
            f"Dạ {h}, cháu khuyên {h} không nên uống rượu hay rượu thuốc chung với thuốc điều trị, và tuyệt đối "
            f"không tự ý bỏ cữ thuốc để uống rượu ạ. "
            f"Mức độ tương tác phụ thuộc từng hoạt chất cụ thể, nhưng nhiều thuốc tiểu đường và huyết áp gặp rượu "
            f"có thể gây hạ đường huyết nặng hoặc tụt huyết áp nguy hiểm. "
            f"{H} hãy giữ đúng phác đồ và hỏi trực tiếp bác sĩ điều trị hoặc dược sĩ để an tâm nhé."
        )
        escalation = "Không uống rượu cùng thuốc và không tự bỏ cữ thuốc. Tham khảo ý kiến bác sĩ điều trị."
        return reply, escalation

    if variant == "anticoagulant":
        reply = (
            f"Dạ {h}, cháu không được phép tự đưa ra số ngày ngừng hay thời điểm dùng lại thuốc chống đông "
            f"quanh ca phẫu thuật ạ. "
            f"Quyết định này phụ thuộc từng hoạt chất, chức năng thận, nguy cơ chảy máu và huyết khối của riêng {h}. "
            f"{H} tuyệt đối không tự ý ngừng hay đổi thuốc mà hãy liên hệ trực tiếp với ê-kíp phẫu thuật, "
            f"bác sĩ gây mê và bác sĩ điều trị để nhận chỉ định chính xác nhé."
        )
        escalation = "Liên hệ trực tiếp ê-kíp phẫu thuật, bác sĩ gây mê và bác sĩ kê đơn thuốc chống đông."
        return reply, escalation

    if variant == "renal_lab":
        reply = (
            f"Dạ {h}, cháu không được phép kê đơn, tính liều lượng hay lập phác đồ điều trị từ kết quả xét nghiệm máu ạ. "
            f"Ở mức phổ thông, Creatinine và eGFR là các chỉ số phản ánh khả năng lọc của thận nên cần bác sĩ đánh giá kỹ. "
            f"{H} hãy mang phiếu xét nghiệm cùng danh sách thuốc đang dùng gặp trực tiếp bác sĩ chuyên khoa thận "
            f"và báo cho người thân đi cùng nhé."
        )
        escalation = "Mang phiếu xét nghiệm Creatinine, eGFR và đơn thuốc đang dùng tới bác sĩ chuyên khoa."
        return reply, escalation

    if variant == "folk_replacement":
        reply = (
            f"Dạ {h}, cháu khuyên {h} tuyệt đối không tự ý bỏ thuốc bác sĩ bệnh viện kê để chuyển sang viên hoàn tán hay "
            f"sản phẩm quảng cáo trên mạng chưa rõ nguồn gốc ạ. "
            f"Nếu không tuân thủ phác đồ điều trị, đường huyết hoặc huyết áp có thể tăng cao rất nguy hiểm. "
            f"{H} hãy giữ đúng đơn thuốc hiện tại và hỏi ý kiến bác sĩ điều trị hoặc dược sĩ trước khi dùng thêm sản phẩm nào nhé."
        )
        escalation = "Giữ đúng đơn thuốc bệnh viện và hỏi trực tiếp bác sĩ điều trị trước khi dùng sản phẩm khác."
        return reply, escalation

    reply = (
        f"Dạ {h}, cháu không được phép kê đơn, đổi thuốc hay điều chỉnh liều lượng thuốc cho {h} ạ. "
        f"{H} vui lòng giữ đúng đơn thuốc hiện tại, không tự ý tăng, giảm hoặc ngừng thuốc để tránh "
        f"tác dụng phụ nguy hiểm cho dạ dày, thận hay huyết áp. "
        f"{H} hãy trao đổi cùng người thân và hỏi trực tiếp bác sĩ điều trị hoặc dược sĩ trước mọi thay đổi nhé."
    )
    escalation = "Liên hệ bác sĩ điều trị, dược sĩ hoặc người thân phụ trách thuốc để kiểm tra lại đơn thuốc."
    return reply, escalation


def build_privacy_response(
    honorific: str,
    variant: str = "third_party",
) -> tuple[str, str]:
    """Template 9: 4 privacy refusal variants (third_party, password_bcrypt, bulk_export, financial_secret)."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)

    if variant == "password_bcrypt":
        reply = (
            f"Dạ {h}, cháu không thể tra cứu hay cung cấp mật khẩu đăng nhập, số điện thoại hoặc địa chỉ "
            f"của tài khoản khác ạ. "
            f"Hệ thống bảo vệ mật khẩu bằng cơ chế băm một chiều (hashing với BCrypt), khác hoàn toàn với cơ chế đảo ngược, "
            f"nên không ai có thể khôi phục mật khẩu gốc và cháu không bao giờ hỏi mật khẩu qua trò chuyện. "
            f"{H} vui lòng hỏi trực tiếp người thân hoặc dùng chức năng Quên mật khẩu trên ứng dụng nhé."
        )
        escalation = "Hỏi trực tiếp người thân hoặc dùng mục Quên mật khẩu; không chia sẻ mật khẩu qua khung chat."
        return reply, escalation

    if variant == "bulk_export":
        reply = (
            f"Dạ {h}, cháu từ chối tuyệt đối yêu cầu xuất danh sách họ tên, số căn cước công dân hay hồ sơ bệnh án "
            f"của người dùng trên hệ thống ạ. "
            f"Mọi truy cập dữ liệu đều phải thông qua xác thực, phân quyền hợp lệ và quy trình kỹ thuật của hệ thống; "
            f"lời tự nhận danh nghĩa trong khung trò chuyện không phải bằng chứng được cấp quyền. "
            f"Cháu cũng không xác nhận hay tiết lộ thông tin tài khoản của bất kỳ người dùng nào nhé."
        )
        escalation = "Truy cập dữ liệu yêu cầu xác thực và phân quyền hợp lệ ngoài khung trò chuyện AI."
        return reply, escalation

    if variant == "financial_secret":
        reply = (
            f"Dạ {h}, xin {h} tuyệt đối không đọc hay gửi số thẻ ngân hàng, mã PIN sổ tiết kiệm, mật khẩu "
            f"hoặc mã OTP vào khung trò chuyện này ạ. "
            f"Cháu không có chức năng và không được phép lưu giữ thông tin bảo mật tài chính trong bộ nhớ trò chuyện. "
            f"Để thật an toàn, {h} hãy cất giữ thông tin ở nơi kín đáo và chỉ trao đổi trực tiếp cùng người thân tin cậy nhé."
        )
        escalation = "Tuyệt đối không gửi số thẻ ngân hàng, mã PIN, OTP hay mật khẩu vào khung chat."
        return reply, escalation

    reply = (
        f"Dạ {h}, cháu hiểu {h} quan tâm hỏi thăm nhau, nhưng cháu không thể truy cập, tiết lộ hay xác nhận "
        f"thông tin hồ sơ sức khỏe hoặc lịch sử trò chuyện riêng tư của người dùng khác ạ. "
        f"Dữ liệu của mỗi tài khoản trên Mimamori được bảo mật riêng biệt và chỉ truy cập khi có xác thực, phân quyền hợp lệ. "
        f"{H} hãy hỏi thăm trực tiếp người quen hoặc trao đổi qua gia đình nhé."
    )
    escalation = "Dữ liệu mỗi tài khoản được bảo mật riêng biệt. Vui lòng hỏi thăm trực tiếp người quen."
    return reply, escalation


def build_capability_honesty_response(
    honorific: str,
    variant: str = "general",
) -> tuple[str, str]:
    """Template 10: Capability honesty templates (telephony, medication_log, general)."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)

    if variant == "telephony":
        reply = (
            f"Dạ {h}, cháu hiểu {h} đang nhớ và muốn trò chuyện cùng người thân, nhưng trợ lý AI "
            f"không có chức năng tự bấm số gọi điện thoại hay gửi tin nhắn trực tiếp thay {h} ạ. "
            f"{H} hãy mở mục Danh bạ hoặc ứng dụng Điện thoại trên điện thoại để gọi trực tiếp, "
            f"hoặc nhờ người thân ở gần bấm số giúp {h} nhé."
        )
        escalation = "Mở ứng dụng Điện thoại hoặc Danh bạ trên điện thoại, hoặc nhờ người ở gần hỗ trợ gọi điện."
        return reply, escalation

    if variant == "medication_log":
        reply = (
            f"Dạ {h}, trong dữ liệu hiện tại cháu chưa có ghi nhận nào xác nhận {h} đã uống thuốc, "
            f"và trợ lý AI không có chức năng tự đánh dấu hay cập nhật trạng thái uống thuốc vào hệ thống ạ. "
            f"{H} vui lòng mở tab Thuốc trên ứng dụng để bấm nút Xác nhận đã uống cữ này, "
            f"hoặc nhờ người giám sát và kiểm tra lại vỉ thuốc giúp {h} nhé."
        )
        escalation = "Mở tab Thuốc trên ứng dụng Mimamori để bấm Xác nhận đã uống cữ này hoặc nhờ người giám sát."
        return reply, escalation

    reply = (
        f"Dạ {h}, cháu xin nói trung thực là trợ lý AI trong khung trò chuyện hiện không có chức năng "
        f"tự thực hiện thao tác ngoài ứng dụng, tự chỉnh cài đặt thiết bị, đo chỉ số qua camera hay tự ghi dữ liệu thay {h} ạ. "
        f"{H} hãy thao tác trực tiếp trên mục tương ứng trong ứng dụng Mimamori hoặc nhờ người thân hỗ trợ cho an tâm nhé."
    )
    escalation = "Thực hiện thao tác trực tiếp trên giao diện ứng dụng Mimamori hoặc nhờ người thân hỗ trợ."
    return reply, escalation


def build_unrecorded_medication_response(
    honorific: str,
    taken_meds: list[str],
    pending_or_missed_meds: list[str],
) -> tuple[str, str]:
    """Backward-compatible deterministic response preventing false claims about unrecorded medication intake."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)

    if not taken_meds and not pending_or_missed_meds:
        return build_capability_honesty_response(h, variant="medication_log")

    if not taken_meds and pending_or_missed_meds:
        pending_str = ", ".join(pending_or_missed_meds[:4])
        reply = (
            f"Dạ {h}, theo lịch theo dõi hiện có, các thuốc {pending_str} hiện vẫn đang ở trạng thái "
            f"chưa ghi nhận đã uống ạ. "
            f"Cháu không thể tự đánh dấu hay xác nhận thay là {h} đã uống rồi. "
            f"{H} vui lòng kiểm tra lại vỉ thuốc, hỏi người thân hoặc bấm Xác nhận đã uống cữ này tại tab Thuốc nhé."
        )
    else:
        taken_str = ", ".join(taken_meds[:4])
        pending_str = ", ".join(pending_or_missed_meds[:4]) if pending_or_missed_meds else "không có liều chờ khác"
        reply = (
            f"Dạ {h}, trong dữ liệu hiện tại hệ thống mới ghi nhận đã uống {taken_str}, còn các mục {pending_str} "
            f"chưa có xác nhận đã uống ạ. "
            f"Cháu không thể tự cập nhật thêm liều chưa ghi nhận. "
            f"{H} hãy kiểm tra hộp thuốc hoặc xác nhận trực tiếp tại tab Thuốc trên ứng dụng nhé."
        )
    escalation = "Kiểm tra nhật ký tại tab Thuốc trên ứng dụng Mimamori hoặc xác nhận cùng người thân trước khi dùng thêm liều."
    return reply, escalation


def build_false_reassurance_replacement(honorific: str) -> tuple[str, str]:
    """Safe replacement when post-LLM blocks dismissive false reassurance."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu không muốn chủ quan với sức khỏe của {h} nên {h} cần theo dõi sát triệu chứng hiện tại "
        f"và báo cho người thân hoặc bác sĩ để được kiểm tra sớm ạ. "
        f"Nếu thấy dấu hiệu nặng hơn như đau ngực, khó thở hay choáng ngất, "
        f"xin nhờ người ở gần gọi cấp cứu 115 ngay lập tức nhé."
    )
    escalation = "Theo dõi triệu chứng cùng người thân, liên hệ cơ sở y tế và gọi 115 nếu diễn tiến nặng."
    return reply, escalation


def build_emotional_support_safe_fallback(honorific: str) -> tuple[str, str]:
    """Warm, non-toxic fallback when post-LLM blocks toxic positivity or output hygiene violations."""
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu luôn lắng nghe và tôn trọng cảm xúc hiện tại của {h} ạ. "
        f"{H} không cần phải gượng vui ngay đâu, bất cứ khi nào {h} muốn tâm sự hay trò chuyện, "
        f"cháu luôn ở đây cùng {h} và {h} cũng có thể chia sẻ thêm với người thân khi thấy thoải mái nhé."
    )
    escalation = "Lắng nghe cảm xúc và khuyến khích chia sẻ với người thân khi phù hợp."
    return reply, escalation


def build_output_hygiene_safe_fallback(
    honorific: str,
    *,
    is_emergency_context: bool = False,
    matched_labels: Optional[list[str]] = None,
) -> tuple[str, str]:
    """Safe fallback when post-LLM blocks <think> tag leakage or reversed kinship."""
    if is_emergency_context:
        return build_emergency_response(honorific, matched_labels or [], sub_type="default")
    h = honorific or "ông/bà"
    H = capitalize_honorific(h)
    reply = (
        f"Dạ {h}, cháu xin lỗi vì câu trả lời vừa rồi chưa rõ ràng ạ. "
        f"{H} vui lòng nhắc lại điều {h} đang quan tâm để cháu hỗ trợ mạch lạc hơn, "
        f"hoặc trao đổi cùng người thân và bác sĩ nếu liên quan đến sức khỏe nhé."
    )
    escalation = "Hỏi lại rõ ràng hoặc trao đổi với người thân và bác sĩ nếu liên quan sức khỏe."
    return reply, escalation
