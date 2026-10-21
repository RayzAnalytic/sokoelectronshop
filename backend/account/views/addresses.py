from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Address
from ..serializers import AddressInputSerializer, AddressSerializer

User = get_user_model()


def _lock_user(user):
    User.objects.select_for_update().get(pk=user.pk)


class AddressListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Address.objects.filter(user=request.user)
        return Response(AddressSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        _lock_user(request.user)

        ser = AddressInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        is_first = not Address.objects.filter(user=request.user).exists()
        make_default = is_first or bool(
            ser.validated_data.get("is_default", False)
        )

        if make_default:
            Address.objects.filter(user=request.user).update(
                is_default=False
            )

        address = Address.objects.create(
            user=request.user,
            **{**ser.validated_data, "is_default": make_default},
        )
        return Response(
            AddressSerializer(address).data,
            status=status.HTTP_201_CREATED,
        )


class AddressDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        address = get_object_or_404(
            Address, pk=pk, user=request.user
        )
        return Response(AddressSerializer(address).data)

    @transaction.atomic
    def patch(self, request, pk):
        _lock_user(request.user)

        address = get_object_or_404(
            Address, pk=pk, user=request.user
        )
        ser = AddressInputSerializer(
            address, data=request.data, partial=True
        )
        ser.is_valid(raise_exception=True)

        requested_default = ser.validated_data.get("is_default")

        if requested_default is True:
            Address.objects.filter(user=request.user).exclude(
                pk=pk
            ).update(is_default=False)

        elif requested_default is False and address.is_default:
            ser.validated_data["is_default"] = True

        ser.save()
        return Response(AddressSerializer(address).data)

    @transaction.atomic
    def delete(self, request, pk):
        _lock_user(request.user)

        address = get_object_or_404(
            Address, pk=pk, user=request.user
        )
        was_default = address.is_default
        address.delete()

        if was_default:
            replacement = (
                Address.objects.filter(user=request.user)
                .order_by("-updated_at")
                .first()
            )
            if replacement and not replacement.is_default:
                replacement.is_default = True
                replacement.save(update_fields=["is_default"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class AddressSetDefaultView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        _lock_user(request.user)

        address = get_object_or_404(
            Address, pk=pk, user=request.user
        )

        Address.objects.filter(user=request.user).exclude(
            pk=pk
        ).update(is_default=False)

        if not address.is_default:
            address.is_default = True
            address.save(update_fields=["is_default"])

        return Response(AddressSerializer(address).data)