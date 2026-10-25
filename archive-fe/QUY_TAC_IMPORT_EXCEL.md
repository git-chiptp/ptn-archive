# Quy tắc nhập transcript bằng Excel

## 1. Cột

Hàng đầu tiên là tiêu đề. File cần `Type`, `Depth` và ít nhất một cột ngôn ngữ:

```text
Sprite | Speaker | Type | Depth | English | Vietnamese
```

- `Sprite` và `Speaker` là tùy chọn. Để trống `Speaker` nếu là lời dẫn.
- Có thể thêm nhiều cột ngôn ngữ; sau khi tải file, chọn cột muốn nhập.
- `Stage`, `Name`, `Description` là metadata tùy chọn. Khi có nhiều ngôn ngữ, đặt tên như `English Stage` hoặc `Vietnamese Description`.
- Tên cột không phân biệt hoa thường và phải khác nhau.
- Không dùng `>`、`>>`, cột trống, hoặc vị trí cột để tạo cấu trúc.

## 2. `Type` và `Depth`

`Type` chỉ có thể là `line`, `choice`, `option`, hoặc `image`. `Depth` là số nguyên không âm; số nhỏ hơn là cấp cao hơn.

- `line`: dòng thoại hoặc lời dẫn.
- `choice`: nội dung câu hỏi; importer tạo một `line` rồi một nhóm choice chỉ chứa các option.
- `option`: phương án thuộc choice gần nhất ở depth thấp hơn.
- `image`: ảnh được tham chiếu trong `Sprite`.

Ví dụ:

```text
choice | 0 | Which route should we take?
option | 1 | Take the forest route
line   | 2 | The forest is dark.
choice | 2 | Should we light a torch?
option | 3 | Yes
line   | 4 | Mira lights the torch.
option | 3 | No
line   | 4 | We continue in the dark.
```

Các dòng cùng nhánh phải được đặt liên tiếp. Choice không có trường `prompt` hoặc dòng `pre-choice` riêng.

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

