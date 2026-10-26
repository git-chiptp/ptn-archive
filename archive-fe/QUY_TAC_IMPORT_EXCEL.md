# Quy tắc nhập transcript bằng Excel

## 1. Cột

Hàng đầu tiên là tiêu đề. File cần `Type`, `Depth` và ít nhất một cột ngôn ngữ:

```text
Sprite | English Speaker | Vietnamese Speaker | Type | Depth | English | Vietnamese
```

- `Sprite` là tùy chọn.
- Speaker nên đặt theo ngôn ngữ, ví dụ `English Speaker` và `Vietnamese Speaker` (cũng chấp nhận `Speaker English` và `Speaker Vietnamese`). Speaker chỉ được gắn với cột ngôn ngữ cùng tên.
- Để trống speaker nếu là lời dẫn. Mỗi cột speaker phải ghi rõ ngôn ngữ tương ứng.
- Có thể thêm nhiều cột ngôn ngữ; sau khi tải file, chọn cột muốn nhập.
- `Stage`, `Name`, `Description` là metadata tùy chọn. Khi có nhiều ngôn ngữ, đặt tên như `English Stage` hoặc `Vietnamese Description`.
- Tên cột không phân biệt hoa thường và phải khác nhau.
- Không dùng `>`、`>>`, cột trống, hoặc vị trí cột để tạo cấu trúc.

## 2. `Type` và `Depth`

`Type` chỉ có thể là `line`, `option`, hoặc `image`. `Depth` là số nguyên không âm; số nhỏ hơn là cấp cao hơn.

- `line`: dòng thoại, lời dẫn, hoặc nội dung bất kỳ có thể chứa các option.
- `option`: phương án thuộc dòng `line` gần nhất ở cùng depth hoặc depth thấp hơn. Option dùng cùng depth với dòng sở hữu; nội dung thuộc option nằm ở depth lớn hơn.
- `image`: ảnh được tham chiếu trong `Sprite`.

Một dòng `line` có thể là câu hỏi hoặc câu nói, cảnh báo, lời dẫn và vẫn có option. Không có dòng `choice` riêng.

Ví dụ:

```text
line   | 0 | The warning is clear. Which route should we take?
option | 0 | Take the forest route
line   | 1 | The forest is dark.
line   | 1 | A low mechanical hum follows you.
option | 0 | Take the old stairwell
line   | 1 | The stairs descend farther than the building should allow.
line   | 0 | The archive door is sealed. Choose a response.
option | 0 | Tell the truth
line   | 1 | Then we face it together.
option | 0 | Change the subject
line   | 1 | You always do that when it matters.
```

Option lồng nhau cũng dùng cùng depth với dòng chứa nó:

```text
line   | 0 | Choose a route.
option | 0 | Take the forest route
line   | 1 | Do you light a torch?
option | 1 | Yes
line   | 2 | You light the torch.
option | 1 | No
line   | 2 | You continue in darkness.
```

Các dòng cùng nhánh phải được đặt liên tiếp. Mỗi option phải có một dòng `line` ở cùng hoặc thấp hơn; các dòng thuộc option phải ở depth lớn hơn.

## 3. Sprite và image

`Sprite` nhận tên asset, ví dụ `chief/chief_1`, `chief/chief_1.png`, hoặc `media:uuid`. Asset trong thư viện phải được tải lên trước.

Với `Type = image`, chỉ đặt giá trị trong `Sprite` và để trống cột ngôn ngữ. Nếu ảnh không tải được, image node không được tạo.

Ảnh nam/nữ dùng hai dòng trong cùng ô bằng cách xuống dòng:

```text
male: chief/chief_male
female: chief/chief_female
```

Nhãn không phân biệt hoa thường; nếu thiếu variant đang chọn, dùng variant còn lại.

## 4. Text nam/nữ

Một dòng `line` có thể có hai nội dung trong cùng ô ngôn ngữ:

```text
male: He opens the door.
female: She opens the door.
```

Mỗi variant phải ở một dòng riêng. Nếu thiếu variant đang chọn, dùng variant còn lại.

## 5. Placeholder `{{name}}`

Có thể viết `{{name}}` trong nội dung ngôn ngữ:

```text
{{name}}, the archive is opening.
```

Placeholder được thay lúc hiển thị bằng tên Chief người đọc nhập. Không phân biệt hoa thường và cho phép khoảng trắng như `{{ name }}`. Nếu để trống, dùng `A`. Chỉ dùng placeholder trong nội dung transcript, không dùng trong `Type`, `Depth`, `Sprite`, hoặc `Speaker`.

